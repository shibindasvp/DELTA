import Cart from "../../models/cart.model.js";
import Address from "../../models/address.model.js";
import Product from "../../models/product.model.js";
import User from "../../models/user.model.js";
import Coupon from "../../models/coupon.model.js";
import WalletTransaction from "../../models/walletTransaction.model.js";
import { getUserCart } from "./cart.service.js";
import { validateAndApplyCoupon } from "./coupon.service.js";
import { getOrCreateWallet, creditWallet, debitWallet } from "./wallet.service.js";
import { findAddressesByUser, findAddressById } from "../../repositories/address.repository.js";
import {
    createOrder,
    findOrderByIdOrNumber,
    findUserOrders
} from "../../repositories/order.repository.js";
import { 
    syncOrderStatusFromItems, 
    syncOrderFinancials,
    getOrderOriginalDiscount,
    deductStockForOrderItem,
    restoreStockForOrderItem 
} from "../admin/order.service.js";
import { assertProductNotUnderDeclineCooldown } from "./cooldown.service.js";

export const getCheckoutDetails = async (userId) => {
    const [cartDetails, addresses, wallet] = await Promise.all([
        getUserCart(userId),
        findAddressesByUser(userId),
        getOrCreateWallet(userId)
    ]);

    if (!cartDetails || cartDetails.items.length === 0) {
        return { isEmpty: true, cart: cartDetails, addresses: [], walletBalance: wallet.balance, wallet };
    }

    const sortedAddresses = [...addresses].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
    const defaultAddress = sortedAddresses.find(a => a.isDefault) || sortedAddresses[0] || null;

    const unlistedItem = cartDetails.items.find(i => i.isUnlisted);
    if (unlistedItem) {
        return {
            isEmpty: false,
            hasStockIssue: true,
            stockIssueMessage: `Timepiece "${unlistedItem.product?.name || 'Selected'}" is currently unavailable in the vault catalog. Please remove it from your shopping bag before proceeding to checkout.`,
            cart: cartDetails,
            addresses: sortedAddresses,
            defaultAddress
        };
    }

    const outOfStockItem = cartDetails.items.find(i => i.isOutOfStock);
    if (outOfStockItem) {
        return {
            isEmpty: false,
            hasStockIssue: true,
            stockIssueMessage: `Timepiece "${outOfStockItem.product?.name || 'Selected'}" (${outOfStockItem.variant?.color || 'Selected'} Edition) is sold out in the vault. Please remove it from your shopping bag before proceeding to checkout.`,
            cart: cartDetails,
            addresses: sortedAddresses,
            defaultAddress
        };
    }

    const exceededItem = cartDetails.items.find(i => i.isQtyExceeded);
    if (exceededItem) {
        return {
            isEmpty: false,
            hasStockIssue: true,
            stockIssueMessage: `Requested quantity for "${exceededItem.product?.name || 'Selected'}" (${exceededItem.variant?.color || 'Selected'} Edition) exceeds available vault stock of ${exceededItem.availableStock} unit(s). Please reduce your quantity before checkout.`,
            cart: cartDetails,
            addresses: sortedAddresses,
            defaultAddress
        };
    }

    const subtotal = cartDetails.subtotal || 0;
    const originalSubtotal = cartDetails.originalSubtotal || subtotal;
    const productDiscount = cartDetails.productDiscount || Math.max(0, originalSubtotal - subtotal);
    const couponDiscount = cartDetails.discountAmount || cartDetails.discount || 0;
    const totalSavings = productDiscount + couponDiscount;
    const shipping = 0; 
    const tax = Math.round(subtotal * 0.18);
    const minRequiredGrandTotal = Math.ceil(originalSubtotal * 0.20);
    const grandTotal = Math.max(minRequiredGrandTotal, subtotal - couponDiscount);

    return {
        isEmpty: false,
        hasStockIssue: false,
        cart: cartDetails,
        appliedCoupon: cartDetails.appliedCoupon || null,
        appliedCoupons: cartDetails.appliedCoupons || (cartDetails.appliedCoupon ? [cartDetails.appliedCoupon] : []),
        couponWarnings: cartDetails.couponWarnings || [],
        addresses: sortedAddresses,
        defaultAddress,
        walletBalance: wallet.balance,
        wallet: { balance: wallet.balance, currency: wallet.currency },
        summary: {
            originalSubtotal,
            productDiscount,
            subtotal,
            discount: couponDiscount,
            couponDiscount,
            totalSavings,
            tax,
            shipping,
            grandTotal,
            appliedCoupons: cartDetails.appliedCoupons || (cartDetails.appliedCoupon ? [cartDetails.appliedCoupon] : [])
        }
    };
};

export const placeOrder = async ({
    userId,
    addressId,
    paymentMethod = "Cash on Delivery",
    paymentStatus = null,
    paymentFailureReason = "",
    razorpayOrderId = "",
    razorpayPaymentId = "",
    razorpaySignature = "",
    paypalOrderId = "",
    paypalCaptureId = "",
    paidAt = null,
    notes = ""
}) => {
    if (!addressId) {
        throw new Error("Please select a delivery destination address.");
    }

    const [user, address, rawCart] = await Promise.all([
        User.findById(userId),
        findAddressById(addressId, userId),
        Cart.findOne({ user: userId }).populate({
            path: "items.product",
            populate: { path: "brand", select: "name slug isActive isDeleted" }
        })
    ]);

    if (!user) {
        throw new Error("Collector account not found.");
    }

    if (!address) {
        throw new Error("Selected delivery address was not found in your private address book.");
    }

    if (!rawCart || !rawCart.items || rawCart.items.length === 0) {
        throw new Error("Your shopping bag is empty. Please add timepieces before placing an order.");
    }

    const orderItems = [];
    let subtotal = 0;
    let originalSubtotal = 0;

    for (const item of rawCart.items) {
        const product = item.product;
        if (!product || product.isDeleted || !product.isActive) {
            throw new Error(`Timepiece "${product?.name || 'Unknown'}" is currently unavailable in the vault catalog.`);
        }

        if (product.brand && (product.brand.isDeleted || product.brand.isActive === false)) {
            throw new Error(`Timepieces from maison "${product.brand.name}" are currently suspended.`);
        }

        if (paymentStatus !== "Failed") {
            await assertProductNotUnderDeclineCooldown(userId, product._id, product.name);
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
        if (availableStock <= 0) {
            const colorLabel = currentVariant ? ` (${currentVariant.color} Edition)` : "";
            throw new Error(`Timepiece "${product.name}"${colorLabel} is sold out in the vault.`);
        }

        if (item.quantity > availableStock) {
            const colorLabel = currentVariant ? ` (${currentVariant.color} Edition)` : "";
            throw new Error(`Cannot place order: "${product.name}"${colorLabel} only has ${availableStock} unit(s) available in vault (you requested ${item.quantity}).`);
        }

        const variantPrice = (currentVariant && currentVariant.price) ? currentVariant.price : product.price;
        const variantDiscount = (currentVariant && currentVariant.discountPrice !== null && currentVariant.discountPrice !== undefined) ? currentVariant.discountPrice : product.discountPrice;
        const effectivePrice = (variantDiscount && variantDiscount < variantPrice) ? variantDiscount : variantPrice;

        const image = (currentVariant?.images && currentVariant.images.length > 0) 
            ? currentVariant.images[0] 
            : ((item.variant?.images && item.variant.images.length > 0) ? item.variant.images[0] : (product.images?.[0] || ""));

        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        for (let q = 0; q < qty; q++) {
            orderItems.push({
                product: product._id,
                productName: product.name,
                brandName: product.brand?.name || product.brandName || "Manufacture",
                variant: {
                    variantId: currentVariant?._id ? currentVariant._id.toString() : (item.variant?.variantId ? item.variant.variantId.toString() : ""),
                    color: currentVariant?.color || item.variant?.color || "Standard Edition",
                    material: currentVariant?.material || item.variant?.material || "Oystersteel 904L",
                    dial: currentVariant?.dial || item.variant?.dial || "Sunburst Dial",
                    sku: currentVariant?.sku || item.variant?.sku || product.modelNumber || "REF-DELTA",
                    image
                },
                price: effectivePrice,
                quantity: 1,
                itemTotal: effectivePrice,
                status: "Pending",
                stockRestored: false
            });
            subtotal += effectivePrice;
            originalSubtotal += variantPrice;
        }
    }

    let discountAmount = 0;
    let orderAppliedCoupons = [];
    let orderAppliedCoupon = { code: "", discountType: "percentage", discountValue: 0, initialDiscountAmount: 0 };

    const cartCoupons = Array.isArray(rawCart.appliedCoupons) && rawCart.appliedCoupons.length > 0
        ? rawCart.appliedCoupons
        : (rawCart.appliedCoupon && rawCart.appliedCoupon.code ? [rawCart.appliedCoupon] : []);

    if (cartCoupons.length > 0) {
        let firstInvalidCouponError = null;
        for (const c of cartCoupons) {
            try {
                const couponValidation = await validateAndApplyCoupon(
                    c.code,
                    subtotal,
                    userId,
                    originalSubtotal,
                    orderAppliedCoupons
                );
                orderAppliedCoupons.push({
                    code: couponValidation.code,
                    discountType: couponValidation.discountType || "percentage",
                    discountValue: couponValidation.discountValue || 0,
                    discountAmount: couponValidation.discountAmount || 0,
                    description: couponValidation.description || ""
                });
                discountAmount += couponValidation.discountAmount;
            } catch (couponErr) {
                if (!firstInvalidCouponError) {
                    firstInvalidCouponError = couponErr;
                }
            }
        }
        if (orderAppliedCoupons.length > 0) {
            orderAppliedCoupon = {
                code: orderAppliedCoupons.map(c => c.code).join(", "),
                discountType: orderAppliedCoupons[0].discountType || "percentage",
                discountValue: orderAppliedCoupons[0].discountValue || 0,
                initialDiscountAmount: discountAmount
            };
        }
        if (firstInvalidCouponError && paymentStatus !== "Failed") {
            rawCart.appliedCoupons = orderAppliedCoupons;
            rawCart.appliedCoupon = orderAppliedCoupons.length > 0 ? orderAppliedCoupons[orderAppliedCoupons.length - 1] : null;
            rawCart.discountAmount = discountAmount;
            await rawCart.save();

            const couponRemovedError = new Error(
                `${firstInvalidCouponError.message} Your order total has been updated—please review before placing your order.`
            );
            couponRemovedError.code = firstInvalidCouponError.code || "COUPON_REMOVED";
            throw couponRemovedError;
        }
    } else if (rawCart.discountAmount) {
        discountAmount = rawCart.discountAmount;
    }


    const effectiveOriginalTotal = originalSubtotal > 0 ? originalSubtotal : subtotal;
    const maxPermissibleTotalDiscount = Math.floor(effectiveOriginalTotal * 0.80);
    const minRequiredGrandTotal = Math.ceil(effectiveOriginalTotal * 0.20);
    const productSavings = Math.max(0, effectiveOriginalTotal - subtotal);

    if (productSavings + discountAmount >= maxPermissibleTotalDiscount) {
        discountAmount = Math.max(0, maxPermissibleTotalDiscount - productSavings - 1);
    }

    const shippingFee = 0;
    const taxAmount = Math.round(subtotal * 0.18);
    const grandTotal = Math.max(minRequiredGrandTotal, subtotal - discountAmount + shippingFee);

    const timestampStr = Date.now().toString(36).toUpperCase();
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `DLT-${timestampStr}-${randomHex}`;

    let safePaymentMethod = "Cash on Delivery";
    if (paymentMethod === "Cash on Delivery" || paymentMethod === "COD") {
        safePaymentMethod = "Cash on Delivery";
    } else if (paymentMethod === "Vault Card") {
        safePaymentMethod = "Vault Card";
    } else if (paymentMethod === "Razorpay") {
        safePaymentMethod = "Razorpay";
    } else if (paymentMethod === "PayPal") {
        safePaymentMethod = "PayPal";
    } else if (paymentMethod === "Bank Wire") {
        safePaymentMethod = "Bank Wire";
    } else if (paymentMethod === "Wallet" || paymentMethod === "DELTA Vault Wallet") {
        safePaymentMethod = "Wallet";
    }

    const defaultPaymentStatus = safePaymentMethod === "Cash on Delivery" ? "Pending" : "Completed";
    const finalPaymentStatus = paymentStatus || defaultPaymentStatus;
    const finalPaidAt = (finalPaymentStatus === "Completed" && !paidAt) ? new Date() : paidAt;

    let walletDebited = false;
    if (safePaymentMethod === "Wallet") {
        await debitWallet({
            userId,
            amount: grandTotal,
            purpose: "Wallet Payment",
            orderNumber,
            description: `Payment for Order ${orderNumber} via DELTA Vault Wallet`
        });
        walletDebited = true;
    }

    const shouldDeductStock = finalPaymentStatus === "Completed" || safePaymentMethod === "Cash on Delivery";
    const deductedItems = [];
    if (shouldDeductStock) {
        try {
            for (const item of rawCart.items) {
                await deductStockForOrderItem(item);
                deductedItems.push(item);
            }
        } catch (deductErr) {
            if (walletDebited) {
                try {
                    await creditWallet({
                        userId,
                        amount: grandTotal,
                        purpose: "Refund",
                        orderNumber,
                        description: `Rollback of wallet debit for failed order ${orderNumber}`
                    });
                } catch (wErr) {
                    console.error("Wallet debit rollback error:", wErr);
                }
            }
            for (const rollbackItem of deductedItems) {
                try {
                    await restoreStockForOrderItem(rollbackItem);
                } catch (rbErr) {
                    console.error("Stock rollback error:", rbErr);
                }
            }
            throw deductErr;
        }
    }

    let newOrder;
    try {
        newOrder = await createOrder({
            orderNumber,
            user: userId,
            collectorName: address.fullName || user.name,
            collectorEmail: user.email,
            items: orderItems,
            originalSubtotal: subtotal,
            originalDiscount: discountAmount,
            subtotal,
            discountAmount,
            appliedCoupon: orderAppliedCoupon,
            appliedCoupons: orderAppliedCoupons,
            shippingFee,
            taxAmount,
            grandTotal,
            orderStatus: "Pending",
            paymentMethod: safePaymentMethod,
            paymentStatus: finalPaymentStatus,
            paymentFailureReason: paymentFailureReason || "",
            isStockDeducted: shouldDeductStock,
            declinedAt: (finalPaymentStatus === "Failed" && paymentFailureReason && /simulate.*decline|bank decline/i.test(paymentFailureReason)) ? new Date() : null,
            razorpayOrderId: razorpayOrderId || "",
            razorpayPaymentId: razorpayPaymentId || "",
            razorpaySignature: razorpaySignature || "",
            paypalOrderId: paypalOrderId || "",
            paypalCaptureId: paypalCaptureId || "",
            paidAt: finalPaidAt,
            shippingAddress: {
                fullName: address.fullName,
                street: address.addressLine,
                city: address.city,
                state: address.state,
                postalCode: address.pincode,
                country: address.country || "India",
                mobile: address.phone
            },
            notes: notes.trim() || "White-Glove Insured Delivery"
        });
    } catch (orderErr) {
        if (walletDebited) {
            try {
                await creditWallet({
                    userId,
                    amount: grandTotal,
                    purpose: "Refund",
                    orderNumber,
                    description: `Rollback of wallet debit for failed order creation ${orderNumber}`
                });
            } catch (wErr) {
                console.error("Wallet debit rollback error:", wErr);
            }
        }
        if (shouldDeductStock) {
            for (const rollbackItem of deductedItems) {
                try {
                    await restoreStockForOrderItem(rollbackItem);
                } catch (rbErr) {
                    console.error("Order rollback error:", rbErr);
                }
            }
        }
        throw orderErr;
    }

    if (walletDebited) {
        try {
            await WalletTransaction.findOneAndUpdate(
                { orderNumber, type: "Debit" },
                { order: newOrder._id }
            );
        } catch (linkErr) {
            console.error("Wallet transaction order link error:", linkErr);
        }
    }

    const isPaymentSuccess = finalPaymentStatus === "Completed" || safePaymentMethod === "Cash on Delivery";

    if (isPaymentSuccess) {
        await clearUserCartAndRegisterCoupons(userId, newOrder);
        rawCart.items = [];
        rawCart.appliedCoupon = null;
        rawCart.appliedCoupons = [];
        rawCart.discountAmount = 0;
    }

    return newOrder;
};

export const clearUserCartAndRegisterCoupons = async (userId, order) => {
    if (!userId) return;

    try {
        await Cart.findOneAndUpdate(
            { user: userId },
            { 
                $set: { 
                    items: [], 
                    appliedCoupon: null, 
                    appliedCoupons: [], 
                    discountAmount: 0 
                } 
            }
        );
    } catch (cartErr) {
        console.error("Cart clear error:", cartErr);
    }

    if (order) {
        const couponsToRegister = Array.isArray(order.appliedCoupons) && order.appliedCoupons.length > 0
            ? order.appliedCoupons
            : (order.appliedCoupon && order.appliedCoupon.code ? [order.appliedCoupon] : []);

        for (const c of couponsToRegister) {
            if (!c || !c.code) continue;
            try {
                await Coupon.findOneAndUpdate(
                    { 
                        code: c.code.toUpperCase(), 
                        isDeleted: false,
                        "usedBy.orderId": { $ne: order._id }
                    },
                    { 
                        $inc: { usageCount: 1 },
                        $push: {
                            usedBy: {
                                user: userId,
                                orderId: order._id,
                                usedAt: new Date()
                            }
                        }
                    }
                );
            } catch (couponErr) {
                console.error("Coupon usage increment error on completion/retry:", couponErr);
            }
        }
    }
};

export const getOrderById = async (orderId, userId = null) => {
    const order = await findOrderByIdOrNumber(orderId, userId);
    if (!order) {
        throw new Error("Order dossier not found.");
    }
    return order;
};

export const getUserOrders = async ({ userId, search = "", status = "" }) => {
    return await findUserOrders({ userId, search, status });
};

export const cancelFullOrder = async ({ userId, orderId, reason = "" }) => {
    if (!reason || !reason.trim()) {
        throw new Error("A reason for cancelling your order is mandatory.");
    }

    const order = await getOrderById(orderId, userId);

    if (order.orderStatus === "Cancelled") {
        throw new Error("This order is already cancelled.");
    }

    if (order.orderStatus === "Shipped" || order.orderStatus === "Out for Delivery") {
        throw new Error("This order has already been shipped and cannot be cancelled in transit. You may request a return once delivered.");
    }

    if (order.orderStatus === "Delivered") {
        throw new Error("Delivered orders cannot be cancelled. You may request a return instead.");
    }

    if (order.orderStatus === "Return Requested" || order.orderStatus === "Returned") {
        throw new Error("Cannot cancel an order with a return in progress or completed.");
    }

    if (order.orderStatus !== "Pending" && order.orderStatus !== "Processing") {
        throw new Error(`Orders can only be cancelled before they are shipped (Current status: "${order.orderStatus}").`);
    }

    const now = new Date();
    for (const item of order.items) {
        if (item.status !== "Cancelled" && item.status !== "Returned" && !item.stockRestored) {
            if (order.isStockDeducted) {
                await restoreStockForOrderItem(item);
            }
            item.stockRestored = true;
            item.status = "Cancelled";
            item.cancelledAt = now;
            item.cancellationReason = reason.trim() || "Full order cancellation requested by collector";
        }
    }
    order.isStockDeducted = false;

    order.orderStatus = "Cancelled";
    order.cancellationReason = reason.trim() || "Collector requested cancellation";
    order.cancelledAt = now;

    const couponCodeToRollback = (order.appliedCoupon && order.appliedCoupon.code) ? order.appliedCoupon.code : null;

    const isPaid = order.paymentStatus === "Completed" || ["Razorpay", "PayPal", "Vault Card", "Wallet"].includes(order.paymentMethod);
    if (isPaid) {
        let unrefundedTotal = 0;
        const originalDiscount = getOrderOriginalDiscount(order);

        for (const item of order.items) {
            if (!item.refunded) {
                const itemDiscount = (order.originalSubtotal > 0 && originalDiscount > 0)
                    ? Math.round((originalDiscount * item.itemTotal) / order.originalSubtotal)
                    : 0;
                const itemRefund = Math.max(0, item.itemTotal - itemDiscount);
                item.refunded = true;
                item.refundAmount = itemRefund;
                unrefundedTotal += itemRefund;
            }
        }

        if (unrefundedTotal > 0) {
            await creditWallet({
                userId: order.user,
                amount: unrefundedTotal,
                purpose: "Order Cancellation Refund",
                orderId: order._id,
                orderNumber: order.orderNumber,
                description: `Refund for cancellation of Order ${order.orderNumber}`
            });
            order.refundAmount = (Number(order.refundAmount) || 0) + unrefundedTotal;
        }
        order.paymentStatus = "Refunded";
    }

    syncOrderStatusFromItems(order);
    if (isPaid) {
        order.paymentStatus = "Refunded";
    }

    const couponsToRollback = Array.isArray(order.appliedCoupons) && order.appliedCoupons.length > 0
        ? order.appliedCoupons
        : (order.appliedCoupon && order.appliedCoupon.code ? [order.appliedCoupon] : []);

    for (const c of couponsToRollback) {
        if (!c || !c.code) continue;
        try {
            await Coupon.findOneAndUpdate(
                { 
                    code: c.code.toUpperCase(),
                    "usedBy.orderId": order._id
                },
                {
                    $inc: { usageCount: -1 },
                    $pull: { usedBy: { user: userId, orderId: order._id } }
                }
            );
        } catch (couponRollbackErr) {
            console.error("Coupon rollback error on order cancellation:", couponRollbackErr);
        }
    }

    await order.save();
    return order;
};

export const cancelOrderItem = async ({ userId, orderId, itemId, reason = "" }) => {
    if (!reason || !reason.trim()) {
        throw new Error("A reason for cancelling this timepiece is mandatory.");
    }

    const order = await getOrderById(orderId, userId);

    if (order.orderStatus === "Cancelled") {
        throw new Error("This order is already cancelled.");
    }

    const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId.toString());
    if (!item) {
        throw new Error("Timepiece line item not found in this order.");
    }

    if (item.status === "Cancelled") {
        throw new Error("This timepiece is already cancelled.");
    }

    if (item.status === "Shipped" || item.status === "Out for Delivery") {
        throw new Error("Timepiece items cannot be cancelled once the order has been shipped. You may request a return once delivered.");
    }

    if (item.status === "Delivered") {
        throw new Error("Delivered orders cannot be cancelled. You may request a return instead.");
    }

    if (item.status === "Return Requested" || item.status === "Returned") {
        throw new Error("Cannot cancel a timepiece with return in progress or completed.");
    }

    if (item.status !== "Pending" && item.status !== "Processing") {
        throw new Error(`Timepiece items can only be cancelled before the order is shipped (Current status: "${item.status}").`);
    }

    if (order.isStockDeducted && !item.stockRestored) {
        await restoreStockForOrderItem(item);
    }
    item.stockRestored = true;

    item.status = "Cancelled";
    item.cancelledAt = new Date();
    item.cancellationReason = reason.trim() || "Item cancellation requested by collector";

    const isPaid = order.paymentStatus === "Completed" || order.paymentStatus === "Refunded" || ["Razorpay", "PayPal", "Vault Card", "Wallet"].includes(order.paymentMethod);
    if (isPaid && !item.refunded) {
        const originalDiscount = getOrderOriginalDiscount(order);
        const itemDiscount = (order.originalSubtotal > 0 && originalDiscount > 0)
            ? Math.round((originalDiscount * item.itemTotal) / order.originalSubtotal)
            : 0;
        const itemRefund = Math.max(0, item.itemTotal - itemDiscount);
        if (itemRefund > 0) {
            await creditWallet({
                userId: order.user,
                amount: itemRefund,
                purpose: "Order Cancellation Refund",
                orderId: order._id,
                orderNumber: order.orderNumber,
                description: `Refund for cancelled timepiece (${item.productName}) in Order ${order.orderNumber}`
            });
            item.refunded = true;
            item.refundAmount = itemRefund;
            order.refundAmount = (Number(order.refundAmount) || 0) + itemRefund;
        }
    }

    syncOrderStatusFromItems(order);
    const nonCancelled = order.items.filter(i => i.status !== "Cancelled");
    if (nonCancelled.length === 0 && isPaid) {
        order.paymentStatus = "Refunded";
    }

    await order.save();
    return { order, cancelledItem: item };
};


export const requestOrderReturn = async ({ userId, orderId, reason }) => {
    if (!reason || !reason.trim()) {
        throw new Error("A reason for returning your timepiece allocation is mandatory.");
    }

    const order = await getOrderById(orderId, userId);

    if (order.orderStatus !== "Delivered") {
        throw new Error(`Returns can only be requested for delivered orders (Current status: "${order.orderStatus}").`);
    }

    const eligibleItems = order.items.filter(it => it.status !== "Cancelled" && it.status !== "Returned");
    const nonDeclinedItems = eligibleItems.filter(it => !it.returnDeclined && !(it.returnAdminNotes && it.returnAdminNotes.toLowerCase().includes("decline")));

    if (order.returnDeclined || nonDeclinedItems.length === 0) {
        throw new Error("Products with a declined return request are not eligible for another return request.");
    }

    const deliveryDate = new Date(order.deliveredAt || order.updatedAt || order.createdAt);
    const returnDeadline = new Date(deliveryDate.getTime() + 5 * 24 * 60 * 60 * 1000);

    if (Date.now() > returnDeadline.getTime()) {
        const formattedDeadline = returnDeadline.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        throw new Error(`The 5-day return window for this delivered order expired on ${formattedDeadline}. Returns are no longer accepted.`);
    }

    order.orderStatus = "Return Requested";
    order.returnReason = reason.trim();
    order.returnRequestedAt = new Date();

    for (const item of nonDeclinedItems) {
        item.status = "Return Requested";
        item.returnReason = reason.trim();
        item.returnRequestedAt = new Date();
    }

    syncOrderStatusFromItems(order);
    await order.save();
    return order;
};


export const requestOrderItemReturn = async ({ userId, orderId, itemId, reason }) => {
    if (!reason || !reason.trim()) {
        throw new Error("A reason for returning your timepiece allocation is mandatory.");
    }

    const order = await getOrderById(orderId, userId);

    const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId.toString());
    if (!item) {
        throw new Error("Timepiece item not found in this order.");
    }

    if (item.status === "Cancelled") {
        throw new Error("Cannot return a cancelled timepiece.");
    }

    if (item.status === "Return Requested" || item.status === "Returned") {
        throw new Error("Return is already requested or completed for this timepiece.");
    }

    if (item.returnDeclined || (item.returnAdminNotes && item.returnAdminNotes.toLowerCase().includes("decline"))) {
        throw new Error("Products with a declined return request are not eligible for another return request.");
    }

    if (item.status !== "Delivered") {
        throw new Error(`Returns can only be requested for delivered timepieces (Current status: "${item.status}").`);
    }

    const deliveryDate = new Date(item.deliveredAt || order.deliveredAt || order.updatedAt || order.createdAt);
    const returnDeadline = new Date(deliveryDate.getTime() + 5 * 24 * 60 * 60 * 1000);

    if (Date.now() > returnDeadline.getTime()) {
        const formattedDeadline = returnDeadline.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        throw new Error(`The 5-day return window for this delivered timepiece expired on ${formattedDeadline}. Returns are no longer accepted.`);
    }

    item.status = "Return Requested";
    item.returnReason = reason.trim();
    item.returnRequestedAt = new Date();

    if (!order.returnRequestedAt) {
        order.returnRequestedAt = item.returnRequestedAt;
    }

    const returnedItems = order.items.filter(i => (i.status === "Return Requested" || i.status === "Returned") && i.returnReason);
    if (returnedItems.length <= 1) {
        order.returnReason = item.returnReason;
    } else {
        order.returnReason = returnedItems.map(i => `${i.productName}: "${i.returnReason}"`).join("; ");
    }

    syncOrderStatusFromItems(order);
    await order.save();

    return { order, item };
};
