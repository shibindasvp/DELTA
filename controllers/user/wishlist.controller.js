import Wishlist from "../../models/wishlist.model.js";
import Product from "../../models/product.model.js";
import Cart from "../../models/cart.model.js";
import { addToCart, getUserCart } from "../../services/user/cart.service.js";
import { formatErrorMessage, normalizeError, respondWithError } from "../../utils/error.js";

export const showWishlist = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect("/login?redirect=/wishlist");
        }

        const userId = req.user._id || req.user.userId;
        let wishlist = await Wishlist.findOne({ user: userId })
            .populate({
                path: "items.product",
                populate: { path: "brand", select: "name slug origin isActive isDeleted" }
            })
            .populate({
                path: "products",
                populate: { path: "brand", select: "name slug origin isActive isDeleted" }
            });

        if (!wishlist) {
            wishlist = await Wishlist.create({ user: userId, items: [], products: [] });
        }


        if ((!wishlist.items || wishlist.items.length === 0) && wishlist.products && wishlist.products.length > 0) {
            const migratedItems = [];
            for (const prod of wishlist.products) {
                if (!prod || prod.isDeleted) continue;
                const defaultVariant = (prod.variants && prod.variants.length > 0) ? prod.variants[0] : null;
                migratedItems.push({
                    product: prod._id,
                    variant: {
                        variantId: defaultVariant ? defaultVariant._id.toString() : "",
                        color: defaultVariant ? defaultVariant.color : "Standard Edition",
                        colorCode: defaultVariant ? defaultVariant.colorCode : "#1b1c1c",
                        material: defaultVariant ? defaultVariant.material : "Oystersteel 904L",
                        dial: defaultVariant ? defaultVariant.dial : "Sunburst Dial",
                        sku: defaultVariant ? defaultVariant.sku : (prod.modelNumber || "REF-DELTA"),
                        images: (defaultVariant && defaultVariant.images && defaultVariant.images.length > 0) ? defaultVariant.images : (prod.images || []),
                        price: defaultVariant ? defaultVariant.price : prod.price,
                        discountPrice: defaultVariant ? defaultVariant.discountPrice : prod.discountPrice
                    }
                });
            }
            wishlist.items = migratedItems;
            await wishlist.save();


            wishlist = await Wishlist.findOne({ user: userId }).populate({
                path: "items.product",
                populate: { path: "brand", select: "name slug origin isActive isDeleted" }
            });
        }

        const sanitizedItems = [];
        let hasPurgedMissing = false;

        for (const item of (wishlist.items || [])) {
            if (!item.product) {
                hasPurgedMissing = true;
                continue;
            }

            const p = item.product;
            const isBrandDisabled = p.brand && (p.brand.isDeleted || p.brand.isActive === false);
            const isProductDisabled = p.isDeleted || p.isActive === false || isBrandDisabled;

            const itemVariantId = item.variant?.variantId ? item.variant.variantId.toString() : "";
            const variantColor = (item.variant?.color || "").trim().toLowerCase();

            let currentVariant = null;
            if (itemVariantId && p.variants && p.variants.length > 0) {
                currentVariant = p.variants.find(v => v._id.toString() === itemVariantId);
            }
            if (!currentVariant && variantColor && p.variants && p.variants.length > 0) {
                currentVariant = p.variants.find(v => v.color.trim().toLowerCase() === variantColor);
            }
            if (!currentVariant && p.variants && p.variants.length > 0) {
                currentVariant = p.variants[0];
            }

            const availableStock = currentVariant ? currentVariant.stock : (p.stock || 0);
            const isOutOfStock = availableStock <= 0;

            const safeVariant = {
                variantId: currentVariant?._id ? currentVariant._id.toString() : (item.variant?.variantId || ""),
                color: currentVariant?.color || item.variant?.color || "Standard Edition",
                colorCode: currentVariant?.colorCode || item.variant?.colorCode || "#1b1c1c",
                material: currentVariant?.material || item.variant?.material || "Oystersteel 904L",
                dial: currentVariant?.dial || item.variant?.dial || "Sunburst Dial",
                sku: currentVariant?.sku || item.variant?.sku || p.modelNumber || "REF-DELTA",
                images: (currentVariant?.images && currentVariant.images.length > 0) ? currentVariant.images : (item.variant?.images && item.variant.images.length > 0 ? item.variant.images : (p.images || [])),
                price: (currentVariant && currentVariant.price !== undefined) ? currentVariant.price : p.price,
                discountPrice: (currentVariant && currentVariant.discountPrice !== undefined) ? currentVariant.discountPrice : p.discountPrice,
                stock: availableStock
            };

            sanitizedItems.push({
                _id: item._id,
                product: p,
                variant: safeVariant,
                availableStock,
                isOutOfStock,
                isProductDisabled,
                isPurchaseDisabled: isProductDisabled || isOutOfStock
            });
        }

        if (hasPurgedMissing) {
            wishlist.items = wishlist.items.filter(item => item.product);
            wishlist.products = [...new Set(wishlist.items.map(item => item.product.toString()))];
            await wishlist.save();
        }

        res.render("user/wishlist/index", {
            items: sanitizedItems,
            products: sanitizedItems.map(i => i.product),
            user: req.user || res.locals.currentUser,
            error: req.query.error || null,
            success: req.query.success || null,
            title: "My Private Collection — DELTA Vault"
        });
    } catch (error) {
        next(error);
    }
};

export const toggleWishlistHandler = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: "Please sign in to save timepieces to your private collection.", 
                redirect: "/login" 
            });
        }

        const userId = req.user._id || req.user.userId;
        const { productId, variantColor = "", variantId = "" } = req.body;
        if (!productId) {
            return res.status(400).json({ success: false, message: "Product ID is required." });
        }

        const product = await Product.findOne({ _id: productId, isDeleted: false, isActive: true }).populate("brand");
        if (!product) {
            return res.status(404).json({ success: false, message: "Timepiece is not available in catalog." });
        }

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = await Wishlist.create({ user: userId, items: [], products: [] });
        }


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

        const variantData = {
            variantId: selectedVariant ? selectedVariant._id.toString() : "",
            color: selectedVariant ? selectedVariant.color : "Standard Edition",
            colorCode: selectedVariant ? selectedVariant.colorCode : "#1b1c1c",
            material: selectedVariant ? selectedVariant.material : "Oystersteel 904L",
            dial: selectedVariant ? selectedVariant.dial : "Sunburst Dial",
            sku: selectedVariant ? selectedVariant.sku : (product.modelNumber || "REF-DELTA"),
            images: (selectedVariant && selectedVariant.images && selectedVariant.images.length > 0) ? selectedVariant.images : (product.images || []),
            price: selectedVariant ? selectedVariant.price : product.price,
            discountPrice: selectedVariant ? selectedVariant.discountPrice : product.discountPrice
        };

        const targetVariantId = variantData.variantId;
        const targetColor = variantData.color.trim().toLowerCase();


        const index = wishlist.items.findIndex(item => {
            if (!item.product || item.product.toString() !== productId.toString()) return false;
            const itemVariantId = item.variant?.variantId ? item.variant.variantId.toString() : "";
            const itemColor = (item.variant?.color || "").trim().toLowerCase();

            if (targetVariantId && itemVariantId) {
                return targetVariantId === itemVariantId;
            }
            if (targetColor) {
                return targetColor === itemColor;
            }
            return true;
        });

        let added = false;
        if (index > -1) {
            wishlist.items.splice(index, 1);
            added = false;
        } else {
            wishlist.items.push({
                product: productId,
                variant: variantData
            });
            added = true;
        }


        wishlist.products = [...new Set(wishlist.items.map(item => item.product.toString()))];
        await wishlist.save();

        const totalWishlistCount = wishlist.items.length;
        const variantKey = `${productId}_${variantData.color.trim().toLowerCase()}`;

        return res.json({ 
            success: true, 
            added, 
            productId,
            variantColor: variantData.color,
            variantId: variantData.variantId,
            variantKey,
            count: totalWishlistCount,
            wishlistCount: totalWishlistCount,
            message: added ? `Saved "${product.name}" (${variantData.color} Edition) to your private collection.` : `Removed "${product.name}" from your private collection.`
        });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Unable to update your wishlist right now.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};

export const removeFromWishlistHandler = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized.", redirect: "/login" });
        }

        const userId = req.user._id || req.user.userId;
        const { productId, itemId, variantId, variantColor } = req.body;

        const wishlist = await Wishlist.findOne({ user: userId });
        if (wishlist && wishlist.items) {
            if (itemId) {
                wishlist.items = wishlist.items.filter(item => item._id.toString() !== itemId.toString());
            } else if (productId) {
                wishlist.items = wishlist.items.filter(item => {
                    if (item.product.toString() !== productId.toString()) return true;
                    if (variantId && item.variant?.variantId && item.variant.variantId.toString() === variantId.toString()) return false;
                    if (variantColor && item.variant?.color && item.variant.color.trim().toLowerCase() === variantColor.trim().toLowerCase()) return false;
                    if (!variantId && !variantColor) return false;
                    return true;
                });
            }

            wishlist.products = [...new Set(wishlist.items.map(item => item.product.toString()))];
            await wishlist.save();
        }

        const totalWishlistCount = wishlist ? wishlist.items.length : 0;

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({ 
                success: true, 
                count: totalWishlistCount, 
                wishlistCount: totalWishlistCount, 
                message: "Removed from private collection." 
            });
        }
        res.redirect("/wishlist?deleted=true");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Unable to remove timepiece from your wishlist.",
            redirectUrl: "/wishlist"
        });
    }
};

export const getWishlistIdsApi = async (req, res) => {
    try {
        if (!req.user) {
            return res.json({ ids: [], variantKeys: [], variantIds: [], count: 0 });
        }
        const userId = req.user._id || req.user.userId;
        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist || !wishlist.items) {
            return res.json({ ids: [], variantKeys: [], variantIds: [], count: 0 });
        }

        const ids = [...new Set(wishlist.items.map(item => item.product.toString()))];
        const variantKeys = wishlist.items.map(item => `${item.product.toString()}_${(item.variant?.color || 'Standard').trim().toLowerCase()}`);
        const variantIds = wishlist.items.map(item => item.variant?.variantId ? item.variant.variantId.toString() : "").filter(Boolean);

        return res.json({ 
            ids, 
            variantKeys, 
            variantIds, 
            count: wishlist.items.length 
        });
    } catch (error) {
        return res.json({ ids: [], variantKeys: [], variantIds: [], count: 0 });
    }
};

export const addAllWishlistToCartHandler = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: "Please sign in to manage your collection.", 
                redirect: "/login" 
            });
        }

        const userId = req.user._id || req.user.userId;
        const [wishlist, cart] = await Promise.all([
            Wishlist.findOne({ user: userId }).populate({
                path: "items.product",
                populate: { path: "brand" }
            }),
            Cart.findOne({ user: userId })
        ]);

        if (!wishlist || !wishlist.items || wishlist.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Your private collection is currently empty." 
            });
        }

        const addedProductIds = [];
        const addedProductNames = [];
        const alreadyInCartProductIds = [];
        const alreadyInCartProductNames = [];
        const failedProducts = [];
        let updatedCart = null;
        const successfullyAddedItemIds = [];

        for (const item of wishlist.items) {
            const product = item.product;
            if (!product || product.isDeleted) continue;

            const isBrandDisabled = product.brand && (product.brand.isDeleted || product.brand.isActive === false);
            const isProductDisabled = product.isActive === false || isBrandDisabled;
            
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

            const effectiveStock = currentVariant ? currentVariant.stock : (product.stock || 0);
            const isOutOfStock = effectiveStock <= 0;

            const pIdStr = product._id.toString();

            if (isProductDisabled || isOutOfStock) {
                failedProducts.push({ 
                    id: item._id.toString(), 
                    name: `${product.name} (${item.variant?.color || 'Edition'})`, 
                    reason: isProductDisabled ? `"${product.name}" is currently disabled` : `"${product.name}" (${item.variant?.color || 'Edition'}) is sold out` 
                });
                continue;
            }

            try {
                updatedCart = await addToCart({
                    userId,
                    productId: product._id,
                    variantColor: item.variant?.color || (currentVariant ? currentVariant.color : "Standard"),
                    variantId: item.variant?.variantId || (currentVariant ? currentVariant._id.toString() : ""),
                    quantity: 1
                });
                addedProductIds.push(item._id.toString());
                addedProductNames.push(`${product.name} (${item.variant?.color || 'Edition'})`);
                successfullyAddedItemIds.push(item._id.toString());
            } catch (err) {
                failedProducts.push({
                    id: item._id.toString(),
                    name: product.name,
                    reason: formatErrorMessage(err, "Unable to add this timepiece to your shopping bag.")
                });
            }
        }

        if (successfullyAddedItemIds.length > 0) {
            wishlist.items = wishlist.items.filter(item => !successfullyAddedItemIds.includes(item._id.toString()));
            wishlist.products = [...new Set(wishlist.items.map(item => item.product.toString()))];
            await wishlist.save();
        }

        const latestCart = updatedCart || (await getUserCart(userId));
        const finalCartCount = latestCart ? latestCart.totalItemCount : 0;

        let message = "";
        let toastType = "success";

        if (addedProductNames.length > 0 && alreadyInCartProductNames.length > 0) {
            message = `Added ${addedProductNames.length} new timepiece edition(s) to bag.`;
            toastType = "success";
        } else if (addedProductNames.length > 0) {
            message = `All ${addedProductNames.length} timepiece edition(s) successfully added to your shopping bag.`;
            toastType = "success";
        } else if (failedProducts.length > 0) {
            message = failedProducts[0].reason || "Unable to add timepieces to bag.";
            toastType = "warning";
        } else {
            message = "No eligible timepieces found to add.";
            toastType = "info";
        }

        return res.json({
            success: true,
            addedProductIds,
            alreadyInCartProductIds,
            addedCount: addedProductNames.length,
            alreadyInCartCount: alreadyInCartProductNames.length,
            failedCount: failedProducts.length,
            cartCount: finalCartCount,
            wishlistCount: wishlist.items.length,
            message,
            toastType
        });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Unable to move wishlist items to your shopping bag right now.");
        return res.status(statusCode).json({ success: false, message });
    }
};
