import Cart from "../../models/cart.model.js";
import Wishlist from "../../models/wishlist.model.js";
import Product from "../../models/product.model.js";
import { validateAndApplyCoupon } from "./coupon.service.js";
import { assertProductNotUnderDeclineCooldown } from "./cooldown.service.js";

const MAX_QTY_PER_ITEM = 3;

export const getUserCart = async (userId) => {
    let cart = await Cart.findOne({ user: userId }).populate({
        path: "items.product",
        populate: { path: "brand", select: "name slug origin isActive isDeleted" }
    });

    if (!cart) {
        cart = await Cart.create({ user: userId, items: [] });
    }

    let hasPurgedMissing = false;
    const sanitizedItems = [];
    let subtotal = 0;
    let originalSubtotal = 0;
    let hasUnavailableItems = false;
    let unavailableCount = 0;
    let hasQtyExceeded = false;
    let qtyExceededCount = 0;

    for (const item of cart.items) {
        if (!item.product) {
            hasPurgedMissing = true;
            continue;
        }

        const isUnlisted = item.product.isDeleted || !item.product.isActive || (item.product.brand && (item.product.brand.isDeleted || !item.product.brand.isActive));

        const itemVariantId = item.variant?.variantId ? item.variant.variantId.toString() : "";
        const variantColor = (item.variant?.color || "").trim().toLowerCase();

        let currentVariant = null;
        if (itemVariantId && item.product.variants && item.product.variants.length > 0) {
            currentVariant = item.product.variants.find(v => v._id.toString() === itemVariantId);
        }
        if (!currentVariant && variantColor && item.product.variants && item.product.variants.length > 0) {
            currentVariant = item.product.variants.find(v => v.color.trim().toLowerCase() === variantColor);
        }
        if (!currentVariant && item.product.variants && item.product.variants.length > 0) {
            currentVariant = item.product.variants[0];
        }

        const availableStock = currentVariant ? currentVariant.stock : (item.product.stock || 0);

        const variantPrice = (currentVariant && currentVariant.price) ? currentVariant.price : (item.product.price || item.price || 0);
        const variantDiscount = (currentVariant && currentVariant.discountPrice !== null && currentVariant.discountPrice !== undefined) ? currentVariant.discountPrice : item.product.discountPrice;
        const effectivePrice = (variantDiscount && variantDiscount < variantPrice) ? variantDiscount : variantPrice;

        item.price = effectivePrice;

        const isOutOfStock = availableStock <= 0;
        const isQtyExceeded = !isUnlisted && !isOutOfStock && item.quantity > availableStock;
        const isUnavailable = isUnlisted || isOutOfStock;

        if (isUnavailable || isQtyExceeded) {
            hasUnavailableItems = true;
        }

        if (isUnavailable) {
            unavailableCount++;
        }

        if (isQtyExceeded) {
            hasQtyExceeded = true;
            qtyExceededCount++;
        }

        const safeVariant = {
            variantId: currentVariant?._id ? currentVariant._id.toString() : (item.variant?.variantId || ""),
            color: currentVariant?.color || item.variant?.color || "Standard Edition",
            colorCode: currentVariant?.colorCode || item.variant?.colorCode || "#1b1c1c",
            material: currentVariant?.material || item.variant?.material || "Oystersteel 904L",
            dial: currentVariant?.dial || item.variant?.dial || "Sunburst Dial",
            sku: currentVariant?.sku || item.variant?.sku || item.product.modelNumber || "REF-DELTA",
            images: (currentVariant?.images && currentVariant.images.length > 0) ? currentVariant.images : (item.variant?.images && item.variant.images.length > 0 ? item.variant.images : (item.product.images || []))
        };

        let unavailReason = "";
        if (isUnlisted) {
            unavailReason = "Currently Unavailable / Unlisted";
        } else if (isOutOfStock) {
            unavailReason = "Sold Out in Vault";
        } else if (isQtyExceeded) {
            unavailReason = `Exceeds vault stock (${availableStock} available)`;
        }

        const effectiveAvailableStock = isUnlisted ? 0 : Math.max(0, availableStock);
        const maxAllowedQty = Math.min(MAX_QTY_PER_ITEM, effectiveAvailableStock);
        const canIncrement = !isUnavailable && !isQtyExceeded && item.quantity < effectiveAvailableStock && item.quantity < MAX_QTY_PER_ITEM;

        sanitizedItems.push({
            _id: item._id,
            product: item.product,
            variant: safeVariant,
            quantity: item.quantity,
            price: item.price,
            originalPrice: variantPrice,
            hasProductDiscount: variantPrice > item.price,
            itemTotal: item.price * item.quantity,
            originalItemTotal: variantPrice * item.quantity,
            availableStock: effectiveAvailableStock,
            effectiveAvailableStock,
            isOutOfStock,
            isUnlisted,
            isUnavailable,
            unavailableReason: unavailReason,
            isQtyExceeded,
            maxAllowedQty,
            canIncrement
        });

        if (!isUnavailable) {
            subtotal += item.price * item.quantity;
            originalSubtotal += variantPrice * item.quantity;
        }
    }

    if (hasPurgedMissing) {
        cart.items = cart.items.filter(item => item.product);
        await cart.save();
    }

    // Validate and evaluate multiple coupons if previously applied
    let appliedCoupons = Array.isArray(cart.appliedCoupons) && cart.appliedCoupons.length > 0
        ? cart.appliedCoupons
        : (cart.appliedCoupon && cart.appliedCoupon.code ? [cart.appliedCoupon] : []);

    let validCoupons = [];
    let discountAmount = 0;
    const couponWarnings = [];

    if (appliedCoupons.length > 0 && subtotal > 0) {
        for (const c of appliedCoupons) {
            if (!c || !c.code) continue;
            try {
                const couponRes = await validateAndApplyCoupon(
                    c.code,
                    subtotal,
                    userId,
                    originalSubtotal,
                    validCoupons
                );
                validCoupons.push({
                    code: couponRes.code,
                    discountType: couponRes.discountType,
                    discountValue: couponRes.discountValue,
                    discountAmount: couponRes.discountAmount,
                    description: couponRes.description
                });
                discountAmount += couponRes.discountAmount;
            } catch (couponValidationErr) {
                // Drop any coupon that invalidates or pushes total discount >= 80%, preserving reason for UI warning
                couponWarnings.push({
                    code: c.code,
                    message: couponValidationErr.message || `Coupon code "${c.code}" has been inactivated by admin and was removed.`,
                    isBlocked: couponValidationErr.code === "COUPON_BLOCKED",
                    isInactive: Boolean(couponValidationErr.isInactive || couponValidationErr.code === "COUPON_BLOCKED")
                });
            }
        }

        const primaryCoupon = validCoupons.length > 0 ? validCoupons[validCoupons.length - 1] : null;
        cart.appliedCoupons = validCoupons;
        cart.appliedCoupon = primaryCoupon;
        cart.discountAmount = discountAmount;
        await cart.save();
    } else if (cart.appliedCoupon || (cart.appliedCoupons && cart.appliedCoupons.length > 0)) {
        cart.appliedCoupons = [];
        cart.appliedCoupon = null;
        cart.discountAmount = 0;
        await cart.save();
    }

    const productDiscount = Math.max(0, originalSubtotal - subtotal);
    const effectiveOriginalTotal = originalSubtotal > 0 ? originalSubtotal : subtotal;
    const maxPermissibleTotalDiscount = Math.floor(effectiveOriginalTotal * 0.80);
    const minRequiredGrandTotal = Math.ceil(effectiveOriginalTotal * 0.20);

    // Enforce strict limit: total discount CANNOT be >= 80% (must pay at least 20%)
    if (productDiscount + discountAmount >= maxPermissibleTotalDiscount) {
        discountAmount = Math.max(0, maxPermissibleTotalDiscount - productDiscount - 1);
    }

    const totalSavings = productDiscount + discountAmount;
    const estimatedTax = Math.round(subtotal * 0.18); 
    const grandTotal = Math.max(minRequiredGrandTotal, subtotal - discountAmount);
    const activeItemCount = sanitizedItems.filter(i => !i.isUnavailable).reduce((acc, item) => acc + item.quantity, 0);
    const totalItemCount = sanitizedItems.reduce((acc, item) => acc + item.quantity, 0);

    return {
        cartId: cart._id,
        items: sanitizedItems,
        totalItemCount,
        activeItemCount,
        originalSubtotal,
        productDiscount,
        totalSavings,
        subtotal,
        discountAmount,
        discount: discountAmount,
        appliedCoupon: cart.appliedCoupon,
        appliedCoupons: validCoupons,
        couponWarnings,
        finalTotal: grandTotal,
        estimatedTax,
        shipping: 0,
        grandTotal,
        hasUnavailableItems,
        unavailableCount,
        hasQtyExceeded,
        qtyExceededCount
    };
};

export const addToCart = async ({ userId, productId, variantColor = "", variantId = "", quantity = 1 }) => {
    const product = await Product.findOne({ _id: productId, isDeleted: false, isActive: true }).populate("brand");
    if (!product || !product.brand || product.brand.isDeleted || !product.brand.isActive) {
        throw new Error("This timepiece is currently unavailable in the catalog.");
    }

    // Check if product is in a 5-minute decline cooldown for this user
    await assertProductNotUnderDeclineCooldown(userId, product._id, product.name);

    let selectedVariant = null;
    if (variantId && product.variants && product.variants.length > 0) {
        selectedVariant = product.variants.find(v => v._id.toString() === variantId.toString());
    }
    if (!selectedVariant && variantColor && product.variants && product.variants.length > 0) {
        selectedVariant = product.variants.find(v => v.color.trim().toLowerCase() === variantColor.trim().toLowerCase());
    }
    if (!selectedVariant && product.variants && product.variants.length > 0) {
        selectedVariant = product.variants[0];
    }

    const availableStock = selectedVariant ? selectedVariant.stock : (product.stock || 0);
    if (availableStock <= 0) {
        const editionLabel = selectedVariant ? ` (${selectedVariant.color} Edition)` : "";
        throw new Error(`"${product.name}"${editionLabel} is currently sold out in the vault.`);
    }

    const requestedQty = Math.max(1, parseInt(quantity, 10) || 1);
    if (requestedQty > availableStock) {
        throw new Error(`Only ${availableStock} unit(s) available in vault for this edition.`);
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
        cart = await Cart.create({ user: userId, items: [] });
    }

    const variantData = {
        variantId: selectedVariant ? selectedVariant._id.toString() : "",
        color: selectedVariant ? selectedVariant.color : "Standard Edition",
        colorCode: selectedVariant ? selectedVariant.colorCode : "#1b1c1c",
        material: selectedVariant ? selectedVariant.material : "Oystersteel 904L",
        dial: selectedVariant ? selectedVariant.dial : "Sunburst Dial",
        sku: selectedVariant ? selectedVariant.sku : (product.modelNumber || "REF-DELTA"),
        images: (selectedVariant && selectedVariant.images && selectedVariant.images.length > 0) ? selectedVariant.images : (product.images || [])
    };

    const variantPrice = (selectedVariant && selectedVariant.price) ? selectedVariant.price : product.price;
    const variantDiscount = (selectedVariant && selectedVariant.discountPrice !== null && selectedVariant.discountPrice !== undefined) ? selectedVariant.discountPrice : product.discountPrice;
    const effectivePrice = (variantDiscount && variantDiscount < variantPrice) ? variantDiscount : variantPrice;

    // Match exact unique variant in cart items
    const targetVariantId = variantData.variantId;
    const targetColor = variantData.color.trim().toLowerCase();

    const existingIndex = cart.items.findIndex(item => {
        if (!item.product || item.product.toString() !== productId.toString()) return false;
        
        const itemVariantId = item.variant?.variantId ? item.variant.variantId.toString() : "";
        const itemColor = (item.variant?.color || "").trim().toLowerCase();

        if (targetVariantId && itemVariantId) {
            return targetVariantId === itemVariantId;
        }
        return itemColor === targetColor;
    });

    if (existingIndex > -1) {
        const existingQty = cart.items[existingIndex].quantity;
        const newQty = existingQty + requestedQty;
        if (existingQty >= availableStock) {
            throw new Error(`You already have all available units (${availableStock}) of the ${variantData.color} edition in your shopping bag.`);
        }
        if (newQty > availableStock) {
            const remaining = Math.max(0, availableStock - existingQty);
            throw new Error(`Cannot add ${requestedQty} more. Only ${remaining} additional unit(s) available in vault (${existingQty} already in your bag).`);
        }
        if (newQty > MAX_QTY_PER_ITEM) {
            throw new Error(`Maximum limit is ${MAX_QTY_PER_ITEM} units per collector/order for this edition (${existingQty} already in your bag).`);
        }
        cart.items[existingIndex].quantity = newQty;
        cart.items[existingIndex].price = effectivePrice;
        cart.items[existingIndex].variant = variantData;
    } else {
        if (requestedQty > availableStock) {
            throw new Error(`Only ${availableStock} unit(s) available in vault for this edition.`);
        }
        if (requestedQty > MAX_QTY_PER_ITEM) {
            throw new Error(`Maximum limit is ${MAX_QTY_PER_ITEM} units per collector/order for this edition.`);
        }
        cart.items.push({
            product: productId,
            variant: variantData,
            quantity: requestedQty,
            price: effectivePrice
        });
    }

    await cart.save();

    try {
        await Wishlist.updateOne(
            { user: userId },
            { $pull: { products: productId } }
        );
    } catch (e) {
    }

    return await getUserCart(userId);
};

export const updateCartItemQuantity = async ({ userId, itemId, action, quantity }) => {
    const cart = await Cart.findOne({ user: userId }).populate({
        path: "items.product",
        populate: { path: "brand", select: "name slug origin isActive isDeleted" }
    });
    if (!cart) {
        throw new Error("Cart not found.");
    }

    const item = cart.items.id(itemId);
    if (!item) {
        throw new Error("Item not found in cart.");
    }

    if (!item.product) {
        cart.items.pull(itemId);
        await cart.save();
        return await getUserCart(userId);
    }

    const product = item.product;
    const isUnlisted = product.isDeleted || !product.isActive || (product.brand && (product.brand.isDeleted || !product.brand.isActive));

    if (isUnlisted) {
        if (action === "decrement" || quantity === 0) {
            let newQty = item.quantity - 1;
            if (quantity !== undefined) newQty = parseInt(quantity, 10) || 0;
            if (newQty <= 0) {
                cart.items.pull(itemId);
                await cart.save();
            } else {
                item.quantity = newQty;
                await cart.save();
            }
            return await getUserCart(userId);
        } else {
            throw new Error("This timepiece is currently not available and quantity cannot be increased.");
        }
    }

    const itemVariantId = item.variant?.variantId ? item.variant.variantId.toString() : "";
    const variantColor = (item.variant?.color || "").trim().toLowerCase();

    let currentVariant = null;
    if (itemVariantId && product.variants && product.variants.length > 0) {
        currentVariant = product.variants.find(v => v._id.toString() === itemVariantId);
    }
    if (!currentVariant && variantColor && product.variants && product.variants.length > 0) {
        currentVariant = product.variants.find(v => v.color.trim().toLowerCase() === variantColor);
    }
    if (!currentVariant && product.variants && product.variants.length > 0) {
        currentVariant = product.variants[0];
    }
    const availableStock = currentVariant ? currentVariant.stock : (product.stock || 0);

    let newQty = item.quantity;
    if (action === "increment") {
        if (availableStock <= 0) {
            throw new Error(`"${product.name}" (${item.variant?.color || 'Selected'} Edition) is currently sold out in the vault.`);
        }
        if (item.quantity >= availableStock) {
            throw new Error(`Vault stock limit (${availableStock} unit${availableStock === 1 ? '' : 's'}) reached for this edition.`);
        }
        if (item.quantity >= MAX_QTY_PER_ITEM) {
            throw new Error(`Maximum limit is ${MAX_QTY_PER_ITEM} units per collector/order for this edition.`);
        }
        newQty += 1;
    } else if (action === "decrement") {
        if (item.quantity > availableStock) {
            // Gracefully snap down if inventory dropped while in cart
            newQty = Math.max(0, Math.min(item.quantity - 1, availableStock));
        } else {
            newQty -= 1;
        }
    } else if (action === "adjust_to_stock") {
        if (availableStock <= 0) {
            cart.items.pull(itemId);
            await cart.save();
            return await getUserCart(userId);
        }
        newQty = Math.min(MAX_QTY_PER_ITEM, availableStock);
    } else if (quantity !== undefined) {
        newQty = parseInt(quantity, 10);
        if (isNaN(newQty)) newQty = 1;
        if (newQty > availableStock) {
            throw new Error(`Only ${availableStock} unit(s) available in vault for this edition.`);
        }
    }

    if (newQty <= 0) {
        cart.items.pull(itemId);
        await cart.save();
        return await getUserCart(userId);
    }

    if (newQty > availableStock) {
        throw new Error(`Only ${availableStock} unit(s) available in vault for this edition.`);
    }

    if (newQty > MAX_QTY_PER_ITEM) {
        throw new Error(`Maximum limit is ${MAX_QTY_PER_ITEM} units per collector/order for this edition.`);
    }

    item.quantity = newQty;
    await cart.save();

    return await getUserCart(userId);
};

export const removeCartItem = async ({ userId, itemId }) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return { totalItemCount: 0, grandTotal: 0, items: [] };

    cart.items.pull(itemId);
    await cart.save();

    return await getUserCart(userId);
};

export const getCartCount = async (userId) => {
    if (!userId) return 0;
    const cart = await Cart.findOne({ user: userId });
    if (!cart || !cart.items) return 0;
    return cart.items.reduce((acc, item) => acc + item.quantity, 0);
};

/**
 * Validates and binds a coupon to the user's shopping bag (supports multiple coupons)
 */
export const applyCartCoupon = async ({ userId, code }) => {
    if (!code || typeof code !== "string" || !code.trim()) {
        throw new Error("Please enter a valid coupon code.");
    }

    const cleanCode = code.trim().toUpperCase();
    const cart = await getUserCart(userId);
    if (!cart || cart.items.length === 0 || cart.subtotal <= 0) {
        throw new Error("Your shopping bag is empty. Please select timepieces before applying a coupon code.");
    }

    // 1. Multiple Coupons Allowed:
    // Check if this specific coupon is already applied
    const existingCoupons = Array.isArray(cart.appliedCoupons) && cart.appliedCoupons.length > 0
        ? cart.appliedCoupons
        : (cart.appliedCoupon && cart.appliedCoupon.code ? [cart.appliedCoupon] : []);

    if (existingCoupons.some(c => c && c.code && c.code.toUpperCase() === cleanCode)) {
        throw new Error(`Coupon code "${cleanCode}" is already applied to your order.`);
    }

    // 2. Validate coupon rules, limits, thresholds, and per-user single redemption (with strict < 80% total discount limit)
    const couponResult = await validateAndApplyCoupon(cleanCode, cart.subtotal, userId, cart.originalSubtotal, existingCoupons);

    // 3. Persist coupons directly on Cart document in database
    const cartDoc = await Cart.findOne({ user: userId });
    let updatedCoupons = [];
    if (cartDoc) {
        const docExisting = Array.isArray(cartDoc.appliedCoupons) && cartDoc.appliedCoupons.length > 0
            ? cartDoc.appliedCoupons
            : (cartDoc.appliedCoupon && cartDoc.appliedCoupon.code ? [cartDoc.appliedCoupon] : []);

        if (docExisting.some(c => c && c.code && c.code.toUpperCase() === cleanCode)) {
            throw new Error(`Coupon code "${cleanCode}" is already applied to your order.`);
        }

        const newCouponObj = {
            code: couponResult.code,
            discountType: couponResult.discountType,
            discountValue: couponResult.discountValue,
            discountAmount: couponResult.discountAmount,
            description: couponResult.description
        };

        updatedCoupons = [...docExisting, newCouponObj];
        const totalDiscount = updatedCoupons.reduce((sum, c) => sum + (Number(c.discountAmount) || 0), 0);

        cartDoc.appliedCoupons = updatedCoupons;
        cartDoc.appliedCoupon = newCouponObj;
        cartDoc.discountAmount = totalDiscount;
        await cartDoc.save();
    } else {
        updatedCoupons = [couponResult];
    }

    const totalCouponDiscount = updatedCoupons.reduce((sum, c) => sum + (Number(c.discountAmount) || 0), 0);
    const productDiscount = cart.productDiscount || 0;
    const totalSavings = productDiscount + totalCouponDiscount;
    const grandTotal = Math.max(Math.ceil((cart.originalSubtotal || cart.subtotal) * 0.20), cart.subtotal - totalCouponDiscount);

    return {
        coupon: couponResult,
        appliedCoupons: updatedCoupons,
        subtotal: cart.subtotal,
        originalSubtotal: cart.originalSubtotal || cart.subtotal,
        productDiscount,
        discountAmount: totalCouponDiscount,
        totalSavings,
        grandTotal
    };
};

/**
 * Removes a specific coupon code or all coupons from the user's shopping bag
 */
export const removeCartCoupon = async ({ userId, code = null }) => {
    const cartDoc = await Cart.findOne({ user: userId });
    if (cartDoc) {
        if (code && Array.isArray(cartDoc.appliedCoupons) && cartDoc.appliedCoupons.length > 0) {
            const cleanCode = code.trim().toUpperCase();
            cartDoc.appliedCoupons = cartDoc.appliedCoupons.filter(c => c && c.code && c.code.toUpperCase() !== cleanCode);
            if (cartDoc.appliedCoupons.length > 0) {
                cartDoc.appliedCoupon = cartDoc.appliedCoupons[cartDoc.appliedCoupons.length - 1];
                cartDoc.discountAmount = cartDoc.appliedCoupons.reduce((sum, c) => sum + (Number(c.discountAmount) || 0), 0);
            } else {
                cartDoc.appliedCoupons = [];
                cartDoc.appliedCoupon = null;
                cartDoc.discountAmount = 0;
            }
        } else {
            cartDoc.appliedCoupons = [];
            cartDoc.appliedCoupon = null;
            cartDoc.discountAmount = 0;
        }
        await cartDoc.save();
    }

    const cart = await getUserCart(userId);
    const subtotal = cart ? cart.subtotal : 0;
    const productDiscount = cart ? (cart.productDiscount || 0) : 0;
    const discountAmount = cart ? (cart.discountAmount || 0) : 0;
    const grandTotal = cart ? (cart.grandTotal || subtotal) : subtotal;

    return {
        subtotal,
        originalSubtotal: cart ? (cart.originalSubtotal || subtotal) : subtotal,
        productDiscount,
        discountAmount,
        appliedCoupons: cart ? (cart.appliedCoupons || []) : [],
        appliedCoupon: cart ? (cart.appliedCoupon || null) : null,
        totalSavings: productDiscount + discountAmount,
        grandTotal
    };
};
