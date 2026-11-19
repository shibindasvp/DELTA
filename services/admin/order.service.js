import User from "../../models/user.model.js";
import Product from "../../models/product.model.js";
import Coupon from "../../models/coupon.model.js";
import { creditWallet } from "../user/wallet.service.js";
import {
    createOrder,
    findOrderById,
    findOrderByIdWithUser,
    findAdminOrdersWithPagination,
    findReturnsWithPagination,
    countOrders
} from "../../repositories/order.repository.js";

export const ensureSampleOrdersExist = async () => {
  
};

export const getOrdersList = async ({
    search = "",
    status = "",
    paymentMethod = "",
    sort = "newest",
    page = 1,
    limit = 10
}) => {
    const query = {};


    if (status && status !== "all") {
        query.orderStatus = status;
    }


    if (paymentMethod && paymentMethod !== "all") {
        query.paymentMethod = paymentMethod;
    }


    if (search && search.trim()) {
        const cleanSearch = search.trim();
        const searchRegex = new RegExp(cleanSearch, "i");
        query.$or = [
            { orderNumber: searchRegex },
            { collectorName: searchRegex },
            { collectorEmail: searchRegex },
            { "shippingAddress.mobile": searchRegex },
            { "shippingAddress.city": searchRegex },
            { "shippingAddress.fullName": searchRegex },
            { "items.productName": searchRegex },
            { "items.brandName": searchRegex }
        ];
    }

    let sortOptions = { createdAt: -1 };
    if (sort === "oldest") {
        sortOptions = { createdAt: 1 };
    } else if (sort === "amount_desc") {
        sortOptions = { grandTotal: -1 };
    } else if (sort === "amount_asc") {
        sortOptions = { grandTotal: 1 };
    } else if (sort === "status") {
        sortOptions = { orderStatus: 1, createdAt: -1 };
    } else {
        sortOptions = { createdAt: -1 }; 
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * pageLimit;

    const { orders, totalItems } = await findAdminOrdersWithPagination({
        query,
        sortOptions,
        skip,
        pageLimit
    });

    const totalPages = Math.ceil(totalItems / pageLimit) || 1;

    const pageNumbers = [];
    const maxDisplayedPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxDisplayedPages / 2));
    let endPage = Math.min(totalPages, startPage + maxDisplayedPages - 1);
    if (endPage - startPage + 1 < maxDisplayedPages) {
        startPage = Math.max(1, endPage - maxDisplayedPages + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }

    return {
        orders,
        pagination: {
            currentPage,
            totalPages,
            totalItems,
            pageLimit,
            hasPrevPage: currentPage > 1,
            hasNextPage: currentPage < totalPages,
            prevPage: currentPage - 1,
            nextPage: currentPage + 1,
            pageNumbers
        }
    };
};

export const getOrderByIdAdmin = async (orderId) => {
    const order = await findOrderByIdWithUser(orderId);
    if (!order) {
        throw new Error("Order not found in vault registry.");
    }
    return order;
};

export const getOrderOriginalDiscount = (order) => {
    if (order.originalDiscount !== undefined && order.originalDiscount !== null && Number(order.originalDiscount) > 0) {
        return Number(order.originalDiscount);
    }
    if (order.appliedCoupon?.initialDiscountAmount && Number(order.appliedCoupon.initialDiscountAmount) > 0) {
        return Number(order.appliedCoupon.initialDiscountAmount);
    }
    if (order.appliedCoupon?.discountAmount && Number(order.appliedCoupon.discountAmount) > 0) {
        return Number(order.appliedCoupon.discountAmount);
    }
    if (order.appliedCoupon?.discountValue && Number(order.appliedCoupon.discountValue) > 100) {
        return Number(order.appliedCoupon.discountValue);
    }
    if (order.appliedCoupon?.discountValue && Number(order.appliedCoupon.discountValue) > 0 && order.originalSubtotal > 0) {
        return Math.round((order.originalSubtotal * Number(order.appliedCoupon.discountValue)) / 100);
    }
    return Number(order.discountAmount) || 0;
};

export const syncOrderFinancials = (order) => {
    const allItems = order.items || [];
    if (allItems.length === 0) return order;

    const calculatedOriginalSubtotal = allItems.reduce(
        (sum, it) => sum + (Number(it.itemTotal) || (Number(it.price) * (Number(it.quantity) || 1))),
        0
    );
    if (!order.originalSubtotal || order.originalSubtotal < calculatedOriginalSubtotal) {
        order.originalSubtotal = calculatedOriginalSubtotal;
    }

    const activeItems = allItems.filter(it => it.status !== "Cancelled" && it.status !== "Returned");
    const cancelledItems = allItems.filter(it => it.status === "Cancelled");
    const returnedItems = allItems.filter(it => it.status === "Returned");

    const activeSubtotal = activeItems.reduce(
        (sum, it) => sum + (Number(it.itemTotal) || (Number(it.price) * (Number(it.quantity) || 1))),
        0
    );
    const cancelledAmount = cancelledItems.reduce(
        (sum, it) => sum + (Number(it.itemTotal) || (Number(it.price) * (Number(it.quantity) || 1))),
        0
    );
    const returnedAmount = returnedItems.reduce(
        (sum, it) => sum + (Number(it.itemTotal) || (Number(it.price) * (Number(it.quantity) || 1))),
        0
    );

    order.cancelledAmount = cancelledAmount;
    order.returnedAmount = returnedAmount;

    const originalDiscount = getOrderOriginalDiscount(order);
    if (!order.originalDiscount && originalDiscount > 0) {
        order.originalDiscount = originalDiscount;
    }

    if (activeItems.length === 0) {
        order.subtotal = 0;
        order.discountAmount = 0;
        order.taxAmount = 0;
        order.grandTotal = 0;

        const originalNetPaid = Math.max(0, order.originalSubtotal - originalDiscount + (Number(order.shippingFee) || 0));

        if (order.paymentStatus === "Completed" || order.paymentStatus === "Refunded") {
            order.paymentStatus = "Refunded";
            order.refundAmount = originalNetPaid;
        } else if (returnedAmount > 0) {
            order.refundAmount = Math.max(0, returnedAmount - originalDiscount);
        } else {
            order.refundAmount = 0;
        }
    } else {
        order.subtotal = activeSubtotal;

        const activeDiscount = (order.originalSubtotal > 0 && originalDiscount > 0)
            ? Math.round((originalDiscount * activeSubtotal) / order.originalSubtotal)
            : 0;

        order.discountAmount = Math.min(activeDiscount, activeSubtotal);
        order.taxAmount = Math.round(activeSubtotal * 0.18);
        const shipping = activeSubtotal > 0 ? (Number(order.shippingFee) || 0) : 0;
        order.grandTotal = Math.max(0, activeSubtotal - order.discountAmount + shipping);

        let calculatedRefund = 0;
        const isPaidOrder = order.paymentStatus === "Completed" || order.paymentStatus === "Refunded" || order.paymentStatus === "Paid" || ["Razorpay", "PayPal", "Vault Card", "Wallet"].includes(order.paymentMethod);

        if (returnedAmount > 0) {
            const proportionalDiscountDeduction = (order.originalSubtotal > 0 && originalDiscount > 0)
                ? Math.round((originalDiscount * returnedAmount) / order.originalSubtotal)
                : 0;
            calculatedRefund += Math.max(0, returnedAmount - proportionalDiscountDeduction);
        }

        if (cancelledAmount > 0 && isPaidOrder) {
            const proportionalDiscountDeduction = (order.originalSubtotal > 0 && originalDiscount > 0)
                ? Math.round((originalDiscount * cancelledAmount) / order.originalSubtotal)
                : 0;
            calculatedRefund += Math.max(0, cancelledAmount - proportionalDiscountDeduction);
        }

        order.refundAmount = calculatedRefund;
    }

    return order;
};

export const syncOrderStatusFromItems = (order) => {
    const allItems = order.items || [];
    if (allItems.length === 0) return order;

    const nonCancelled = allItems.filter(i => i.status !== "Cancelled");

    if (nonCancelled.length === 0) {
        order.orderStatus = "Cancelled";
        if (!order.cancelledAt) order.cancelledAt = new Date();
        if (!order.cancellationReason) {
            const reasons = allItems.map(i => i.cancellationReason).filter(Boolean);
            order.cancellationReason = reasons.length > 0 ? reasons.join("; ") : "All items cancelled";
        }
        syncOrderFinancials(order);
        return order;
    }

    if (nonCancelled.every(i => i.status === "Returned")) {
        order.orderStatus = "Returned";
        if (!order.returnedAt) order.returnedAt = new Date();
        const returnedItemsWithReason = nonCancelled.filter(i => i.returnReason);
        if (!order.returnReason && returnedItemsWithReason.length > 0) {
            if (returnedItemsWithReason.length === 1) {
                order.returnReason = returnedItemsWithReason[0].returnReason;
            } else {
                order.returnReason = returnedItemsWithReason.map(i => `${i.productName}: "${i.returnReason}"`).join("; ");
            }
        }
        syncOrderFinancials(order);
        return order;
    }

    if (nonCancelled.every(i => ["Return Requested", "Delivered", "Returned"].includes(i.status)) && nonCancelled.some(i => i.status === "Return Requested")) {
        order.orderStatus = "Return Requested";
        if (!order.returnRequestedAt) order.returnRequestedAt = new Date();
        const returnedItemsWithReason = nonCancelled.filter(i => (i.status === "Return Requested" || i.status === "Returned") && i.returnReason);
        if (!order.returnReason && returnedItemsWithReason.length > 0) {
            if (returnedItemsWithReason.length === 1) {
                order.returnReason = returnedItemsWithReason[0].returnReason;
            } else {
                order.returnReason = returnedItemsWithReason.map(i => `${i.productName}: "${i.returnReason}"`).join("; ");
            }
        }
        syncOrderFinancials(order);
        return order;
    }


    if (nonCancelled.every(i => ["Delivered", "Returned"].includes(i.status))) {
        order.orderStatus = "Delivered";
        if (!order.deliveredAt) order.deliveredAt = new Date();
        if (order.paymentMethod === "Cash on Delivery") {
            order.paymentStatus = "Completed";
        }
        syncOrderFinancials(order);
        return order;
    }

    if (nonCancelled.every(i => ["Out for Delivery", "Delivered", "Return Requested", "Returned"].includes(i.status))) {
        order.orderStatus = "Out for Delivery";
        syncOrderFinancials(order);
        return order;
    }

    if (nonCancelled.every(i => ["Shipped", "Out for Delivery", "Delivered", "Return Requested", "Returned"].includes(i.status))) {
        order.orderStatus = "Shipped";
        syncOrderFinancials(order);
        return order;
    }

    if (nonCancelled.some(i => i.status === "Out for Delivery")) {
        order.orderStatus = "Out for Delivery";
        syncOrderFinancials(order);
        return order;
    }
    if (nonCancelled.some(i => i.status === "Shipped")) {
        order.orderStatus = "Shipped";
        syncOrderFinancials(order);
        return order;
    }

    if (nonCancelled.some(i => i.status === "Processing")) {
        order.orderStatus = "Processing";
        syncOrderFinancials(order);
        return order;
    }


    order.orderStatus = "Pending";
    syncOrderFinancials(order);
    return order;
};

export const ORDER_STATUS_SEQUENCE = [
    "Pending",
    "Processing",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Return Requested",
    "Returned"
];

export const ALLOWED_STATUS_TRANSITIONS = {
    "Pending": ["Processing", "Cancelled"],
    "Processing": ["Shipped", "Cancelled"],
    "Shipped": ["Out for Delivery"],
    "Out for Delivery": ["Delivered"],
    "Delivered": ["Return Requested"],
    "Return Requested": ["Returned", "Delivered"],
    "Returned": [],
    "Cancelled": []
};

export const validateStatusTransition = (currentStatus, newStatus, entityType = "Order") => {
    if (!currentStatus || currentStatus === newStatus) {
        return;
    }

    if (currentStatus === "Cancelled" || currentStatus === "Returned") {
        throw new Error(`Cannot modify ${entityType} status from "${currentStatus}". "${currentStatus}" is a terminal state.`);
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(newStatus)) {
        const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(currentStatus);
        const newIndex = ORDER_STATUS_SEQUENCE.indexOf(newStatus);

        if (currentIndex !== -1 && newIndex !== -1 && newIndex < currentIndex) {
            throw new Error(`Status cannot be moved backward from "${currentStatus}" to "${newStatus}". Progression must move strictly forward one by one.`);
        }

        if (currentIndex !== -1 && newIndex !== -1 && newIndex > currentIndex + 1) {
            const expectedNext = ORDER_STATUS_SEQUENCE[currentIndex + 1];
            throw new Error(`Cannot skip status steps from "${currentStatus}" to "${newStatus}". The required next step in sequence is "${expectedNext}".`);
        }

        throw new Error(`Invalid status transition from "${currentStatus}" to "${newStatus}". Progression must move strictly forward one by one: Pending -> Processing -> Shipped -> Out for Delivery -> Delivered -> Return Requested -> Returned.`);
    }
};

export const deductStockForOrderItem = async (item) => {
    if (!item) return;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const productId = item.product?._id || item.product;
    if (!productId) return;

    const product = await Product.findById(productId);
    if (!product) {
        throw new Error("Timepiece not found in vault registry.");
    }

    const variantId = item.variant?.variantId ? item.variant.variantId.toString() : "";
    const variantColor = (item.variant?.color || "").trim().toLowerCase();

    let matchedVariant = null;
    if (product.variants && product.variants.length > 0) {
        if (variantId) {
            matchedVariant = product.variants.find(v => v._id && v._id.toString() === variantId);
        }
        if (!matchedVariant && variantColor) {
            matchedVariant = product.variants.find(v => v.color && v.color.trim().toLowerCase() === variantColor);
        }
        if (!matchedVariant) {
            matchedVariant = product.variants[0];
        }
    }

    if (matchedVariant) {
        if (Number(matchedVariant.stock) < qty) {
            throw new Error(`Insufficient vault stock for "${product.name}" (${matchedVariant.color} Edition). Available: ${matchedVariant.stock}, Requested: ${qty}.`);
        }
        matchedVariant.stock = Math.max(0, (Number(matchedVariant.stock) || 0) - qty);
        product.stock = Math.max(0, product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0));
    } else {
        if (Number(product.stock) < qty) {
            throw new Error(`Insufficient vault stock for "${product.name}". Available: ${product.stock}, Requested: ${qty}.`);
        }
        product.stock = Math.max(0, (Number(product.stock) || 0) - qty);
    }

    await product.save();
    item.stockRestored = false;
};

export const restoreStockForOrderItem = async (item) => {
    if (!item) return;
    if (item.stockRestored) return;

    const qty = Math.max(1, Number(item.quantity) || 1);
    const productId = item.product?._id || item.product;
    if (!productId) return;

    const product = await Product.findById(productId);
    if (!product) return;

    const variantId = item.variant?.variantId ? item.variant.variantId.toString() : "";
    const variantColor = (item.variant?.color || "").trim().toLowerCase();

    let matchedVariant = null;
    if (product.variants && product.variants.length > 0) {
        if (variantId) {
            matchedVariant = product.variants.find(v => v._id && v._id.toString() === variantId);
        }
        if (!matchedVariant && variantColor) {
            matchedVariant = product.variants.find(v => v.color && v.color.trim().toLowerCase() === variantColor);
        }
        if (!matchedVariant) {
            matchedVariant = product.variants[0];
        }
    }

    if (matchedVariant) {
        matchedVariant.stock = (Number(matchedVariant.stock) || 0) + qty;
        product.stock = product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    } else {
        product.stock = (Number(product.stock) || 0) + qty;
    }

    await product.save();
    item.stockRestored = true;
};

export const updateOrderStatus = async (orderId, newStatus, reason = "") => {
    const validStatuses = [
        "Pending",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Return Requested",
        "Returned"
    ];

    if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status "${newStatus}". Must be one of: ${validStatuses.join(", ")}.`);
    }

    const order = await findOrderById(orderId);
    if (!order) {
        throw new Error("Order not found.");
    }

    const previousStatus = order.orderStatus;

    if (newStatus === previousStatus) {
        return order;
    }

    validateStatusTransition(previousStatus, newStatus, "order");

    if (newStatus === "Return Requested") {
        throw new Error("Return requests can only be initiated by the collector upon delivery within 5 days.");
    }
    if (newStatus === "Returned" && previousStatus !== "Return Requested") {
        throw new Error("Direct order return by administrator is restricted without an official collector return request.");
    }

    if (newStatus === "Cancelled") {
        let unrefundedCancelAmount = 0;
        const originalDiscount = getOrderOriginalDiscount(order);

        const isPaid = (order.paymentStatus === "Completed" || order.paymentStatus === "Refunded" || order.paymentStatus === "Paid" || ["Razorpay", "PayPal", "Vault Card", "Wallet"].includes(order.paymentMethod)) && order.paymentStatus !== "Failed";

        for (const item of order.items) {
            if (item.status !== "Cancelled" && item.status !== "Returned") {
                if (order.isStockDeducted && !item.stockRestored) {
                    await restoreStockForOrderItem(item);
                }
                item.stockRestored = true;
                item.status = "Cancelled";
                item.cancelledAt = new Date();
                if (reason) item.cancellationReason = reason.trim();

                if (isPaid && !item.refunded) {
                    const itemDiscount = (order.originalSubtotal > 0 && originalDiscount > 0)
                        ? Math.round((originalDiscount * item.itemTotal) / order.originalSubtotal)
                        : 0;
                    const itemRefund = Math.max(0, item.itemTotal - itemDiscount);
                    item.refunded = true;
                    item.refundAmount = itemRefund;
                    unrefundedCancelAmount += itemRefund;
                }
            }
        }
        order.cancelledAt = new Date();
        if (reason) order.cancellationReason = reason.trim();

        if (isPaid && unrefundedCancelAmount > 0) {
            await creditWallet({
                userId: order.user,
                amount: unrefundedCancelAmount,
                purpose: "Order Cancellation Refund",
                orderId: order._id,
                orderNumber: order.orderNumber,
                description: `Direct refund for cancellation of Order ${order.orderNumber}`
            });
            order.refundAmount = (Number(order.refundAmount) || 0) + unrefundedCancelAmount;
            order.paymentStatus = "Refunded";
        }

        if (order.appliedCoupon?.code) {
            try {
                await Coupon.findOneAndUpdate(
                    { code: order.appliedCoupon.code.toUpperCase() },
                    {
                        $inc: { usageCount: -1 },
                        $pull: { usedBy: { orderId: order._id } }
                    }
                );
            } catch (couponRollbackErr) {
                console.error("Coupon rollback error on admin order cancellation:", couponRollbackErr);
            }
        }
    }

    if (newStatus === "Returned" && previousStatus === "Return Requested") {
        let unrefundedReturnAmount = 0;
        const originalDiscount = getOrderOriginalDiscount(order);

        for (const item of order.items) {
            if (item.status !== "Returned" && item.status !== "Cancelled") {
                await restoreStockForOrderItem(item);
                item.status = "Returned";
                item.returnedAt = new Date();
                if (reason) item.returnReason = reason.trim();

                if (!item.refunded) {
                    const itemDiscount = (order.originalSubtotal > 0 && originalDiscount > 0)
                        ? Math.round((originalDiscount * item.itemTotal) / order.originalSubtotal)
                        : 0;
                    const itemRefund = Math.max(0, item.itemTotal - itemDiscount);
                    item.refunded = true;
                    item.refundAmount = itemRefund;
                    unrefundedReturnAmount += itemRefund;
                }
            }
        }
        order.returnedAt = new Date();
        if (reason) order.returnReason = reason.trim();

        if (unrefundedReturnAmount > 0) {
            await creditWallet({
                userId: order.user,
                amount: unrefundedReturnAmount,
                purpose: "Order Return Refund",
                orderId: order._id,
                orderNumber: order.orderNumber,
                description: `Refund for authorized return of Order ${order.orderNumber}`
            });
        }
        order.paymentStatus = "Refunded";
    }

    if (newStatus === "Delivered") {
        if (!order.deliveredAt) {
            order.deliveredAt = new Date();
        }
        if (previousStatus === "Return Requested") {
            const now = new Date();
            order.returnDeclined = true;
            order.returnDeclinedAt = now;
            order.returnProcessedAt = now;
            if (reason) order.returnAdminNotes = `Decline Reason: ${reason.trim()}`;
            for (const item of order.items) {
                if (item.status === "Return Requested") {
                    item.status = "Delivered";
                    item.returnDeclined = true;
                    item.returnDeclinedAt = now;
                    item.returnProcessedAt = now;
                    if (reason) item.returnAdminNotes = `Decline Reason: ${reason.trim()}`;
                }
            }
        } else {
            for (const item of order.items) {
                if (item.status !== "Cancelled" && item.status !== "Returned" && item.status !== "Delivered") {
                    item.status = "Delivered";
                    if (!item.deliveredAt) {
                        item.deliveredAt = new Date();
                    }
                }
            }
        }
        if (order.paymentMethod === "Cash on Delivery") {
            order.paymentStatus = "Completed";
        }
    } else if (newStatus !== "Cancelled" && newStatus !== "Returned") {
        for (const item of order.items) {
            if (item.status !== "Cancelled" && item.status !== "Returned") {
                item.status = newStatus;
                if (newStatus === "Shipped" && !item.shippedAt) item.shippedAt = new Date();
                if (newStatus === "Out for Delivery" && !item.outForDeliveryAt) item.outForDeliveryAt = new Date();
            }
        }
    }

    order.orderStatus = newStatus;
    syncOrderStatusFromItems(order);
    await order.save();

    return order;
};


export const updateOrderItemStatus = async (orderId, itemId, newStatus, reason = "") => {
    const validStatuses = [
        "Pending",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Return Requested",
        "Returned"
    ];

    if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status "${newStatus}". Must be one of: ${validStatuses.join(", ")}.`);
    }

    const order = await findOrderById(orderId);
    if (!order) {
        throw new Error("Order not found.");
    }

    const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId.toString());
    if (!item) {
        throw new Error("Specified timepiece item was not found in this order.");
    }

    const previousItemStatus = item.status;
    const variantColor = item.variant?.color ? item.variant.color.trim() : "";

    if (newStatus === previousItemStatus) {
        return { order, item };
    }

    validateStatusTransition(previousItemStatus, newStatus, "timepiece item");

    if (newStatus === "Return Requested") {
        throw new Error("Return requests can only be initiated by the collector upon delivery within 5 days.");
    }
    if (newStatus === "Returned" && previousItemStatus !== "Return Requested") {
        throw new Error("Direct timepiece return by administrator is restricted without an official collector return request.");
    }

    if (newStatus === "Cancelled") {
        if (item.status !== "Cancelled" && item.status !== "Returned") {
            if (order.isStockDeducted && !item.stockRestored) {
                await restoreStockForOrderItem(item);
            }
            item.stockRestored = true;
            item.status = "Cancelled";
            item.cancelledAt = new Date();
            if (reason) item.cancellationReason = reason.trim();

            const isPaid = (order.paymentStatus === "Completed" || order.paymentStatus === "Refunded" || order.paymentStatus === "Paid" || ["Razorpay", "PayPal", "Vault Card", "Wallet"].includes(order.paymentMethod)) && order.paymentStatus !== "Failed";
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
                        description: `Direct refund for cancelled timepiece (${item.productName}) in Order ${order.orderNumber}`
                    });
                    item.refunded = true;
                    item.refundAmount = itemRefund;
                    order.refundAmount = (Number(order.refundAmount) || 0) + itemRefund;
                }
            }
        }
    }

    if (newStatus === "Returned" && previousItemStatus === "Return Requested") {
        await restoreStockForOrderItem(item);
        item.returnedAt = new Date();
        item.returnProcessedAt = new Date();
        if (reason) item.returnAdminNotes = reason.trim();

        if (!item.refunded) {
            const originalDiscount = getOrderOriginalDiscount(order);
            const itemDiscount = (order.originalSubtotal > 0 && originalDiscount > 0)
                ? Math.round((originalDiscount * item.itemTotal) / order.originalSubtotal)
                : 0;
            const itemRefund = Math.max(0, item.itemTotal - itemDiscount);
            if (itemRefund > 0) {
                await creditWallet({
                    userId: order.user,
                    amount: itemRefund,
                    purpose: "Order Return Refund",
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    description: `Refund for authorized return of timepiece (${item.productName}) in Order ${order.orderNumber}`
                });
                item.refunded = true;
                item.refundAmount = itemRefund;
                order.refundAmount = (Number(order.refundAmount) || 0) + itemRefund;
            }
        }
    }

    if (newStatus === "Delivered" && previousItemStatus === "Return Requested") {
        item.returnDeclined = true;
        item.returnDeclinedAt = new Date();
        item.returnProcessedAt = new Date();
        if (reason) item.returnAdminNotes = `Decline Reason: ${reason.trim()}`;

        const activeItems = order.items.filter(i => i.status !== "Cancelled" && i.status !== "Returned");
        if (activeItems.length > 0 && activeItems.every(i => i.returnDeclined)) {
            order.returnDeclined = true;
            order.returnDeclinedAt = new Date();
        }
    }

    if (newStatus === "Shipped") {
        item.shippedAt = item.shippedAt || new Date();
    } else if (newStatus === "Out for Delivery") {
        item.outForDeliveryAt = item.outForDeliveryAt || new Date();
    } else if (newStatus === "Delivered") {
        item.deliveredAt = item.deliveredAt || new Date();
    }

    item.status = newStatus;

    syncOrderStatusFromItems(order);

    await order.save();
    return { order, item };
};


export const getReturnsList = async ({
    search = "",
    status = "",
    sort = "newest",
    page = 1,
    limit = 10
} = {}) => {
    const query = {
        $or: [
            { orderStatus: { $in: ["Return Requested", "Returned"] } },
            { "items.status": { $in: ["Return Requested", "Returned"] } }
        ]
    };

    if (status && status !== "all" && status !== "") {
        query.orderStatus = status;
    }

    if (search && search.trim() !== "") {
        const s = search.trim();
        query.$and = [
            {
                $or: [
                    { orderNumber: { $regex: s, $options: "i" } },
                    { collectorName: { $regex: s, $options: "i" } },
                    { collectorEmail: { $regex: s, $options: "i" } },
                    { "shippingAddress.mobile": { $regex: s, $options: "i" } },
                    { "items.productName": { $regex: s, $options: "i" } },
                    { "items.brandName": { $regex: s, $options: "i" } }
                ]
            }
        ];
    }

    let sortOption = { returnRequestedAt: -1, updatedAt: -1 };
    if (sort === "oldest") sortOption = { returnRequestedAt: 1, updatedAt: 1 };
    if (sort === "valuation_desc") sortOption = { grandTotal: -1 };
    if (sort === "valuation_asc") sortOption = { grandTotal: 1 };

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * pageLimit;

    const { returns, totalItems } = await findReturnsWithPagination({
        query,
        sortOption,
        skip,
        pageLimit
    });

    const totalPages = Math.ceil(totalItems / pageLimit) || 1;

    return {
        returns,
        pagination: {
            currentPage,
            totalPages,
            totalItems,
            pageLimit,
            hasPrevPage: currentPage > 1,
            hasNextPage: currentPage < totalPages,
            prevPage: currentPage - 1,
            nextPage: currentPage + 1
        }
    };
};

export const approveOrderReturn = async (orderId, adminNotes = "") => {
    const order = await findOrderById(orderId);
    if (!order) {
        throw new Error("Order not found in vault registry.");
    }

    if (order.orderStatus !== "Return Requested" && !order.items.some(i => i.status === "Return Requested")) {
        throw new Error(`Order ${order.orderNumber} is not currently awaiting return authorization.`);
    }

    const now = new Date();
    let unrefundedReturnAmount = 0;
    const originalDiscount = getOrderOriginalDiscount(order);

    for (const item of order.items) {
        if (item.status === "Return Requested") {
            await restoreStockForOrderItem(item);
            item.status = "Returned";
            item.returnedAt = now;
            item.returnProcessedAt = now;
            if (adminNotes) item.returnAdminNotes = adminNotes.trim();

            if (!item.refunded) {
                const itemDiscount = (order.originalSubtotal > 0 && originalDiscount > 0)
                    ? Math.round((originalDiscount * item.itemTotal) / order.originalSubtotal)
                    : 0;
                const itemRefund = Math.max(0, item.itemTotal - itemDiscount);
                item.refunded = true;
                item.refundAmount = itemRefund;
                order.refundAmount = (Number(order.refundAmount) || 0) + itemRefund;
                unrefundedReturnAmount += itemRefund;
            }
        }
    }

    order.orderStatus = "Returned";
    order.returnedAt = now;
    order.returnProcessedAt = now;
    if (adminNotes) order.returnAdminNotes = adminNotes.trim();

    if (unrefundedReturnAmount > 0) {
        await creditWallet({
            userId: order.user,
            amount: unrefundedReturnAmount,
            purpose: "Order Return Refund",
            orderId: order._id,
            orderNumber: order.orderNumber,
            description: `Refund for authorized return of Order ${order.orderNumber}`
        });
    }

    syncOrderStatusFromItems(order);
    order.paymentStatus = "Refunded";
    await order.save();

    return order;
};


export const declineOrderReturn = async (orderId, declineReason = "") => {
    const order = await findOrderById(orderId);
    if (!order) {
        throw new Error("Order not found in vault registry.");
    }

    if (order.orderStatus !== "Return Requested" && !order.items.some(i => i.status === "Return Requested")) {
        throw new Error(`Order ${order.orderNumber} is not currently awaiting return authorization.`);
    }

    const now = new Date();

    for (const item of order.items) {
        if (item.status === "Return Requested") {
            item.status = "Delivered";
            item.returnDeclined = true;
            item.returnDeclinedAt = now;
            item.returnProcessedAt = now;
            if (declineReason) item.returnAdminNotes = `Decline Reason: ${declineReason.trim()}`;
        }
    }

    order.orderStatus = "Delivered";
    order.returnDeclined = true;
    order.returnDeclinedAt = now;
    order.returnProcessedAt = now;
    if (declineReason) order.returnAdminNotes = `Decline Reason: ${declineReason.trim()}`;

    syncOrderStatusFromItems(order);
    await order.save();

    return order;
};


export const approveItemReturn = async (orderId, itemId, adminNotes = "") => {
    const order = await findOrderById(orderId);
    if (!order) {
        throw new Error("Order not found.");
    }
    const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId.toString());
    if (!item) {
        throw new Error("Timepiece item not found in order.");
    }
    if (item.status !== "Return Requested") {
        throw new Error("Timepiece item is not in Return Requested state.");
    }

    const now = new Date();
    await restoreStockForOrderItem(item);

    item.status = "Returned";
    item.returnedAt = now;
    item.returnProcessedAt = now;
    if (adminNotes) item.returnAdminNotes = adminNotes.trim();

    if (!item.refunded) {
        const originalDiscount = getOrderOriginalDiscount(order);
        const itemDiscount = (order.originalSubtotal > 0 && originalDiscount > 0)
            ? Math.round((originalDiscount * item.itemTotal) / order.originalSubtotal)
            : 0;
        const itemRefund = Math.max(0, item.itemTotal - itemDiscount);
        if (itemRefund > 0) {
            await creditWallet({
                userId: order.user,
                amount: itemRefund,
                purpose: "Order Return Refund",
                orderId: order._id,
                orderNumber: order.orderNumber,
                description: `Refund for authorized return of timepiece (${item.productName}) in Order ${order.orderNumber}`
            });
            item.refunded = true;
            item.refundAmount = itemRefund;
        }
    }

    syncOrderStatusFromItems(order);
    const nonReturnedOrCancelled = order.items.filter(i => i.status !== "Cancelled" && i.status !== "Returned");
    if (nonReturnedOrCancelled.length === 0) {
        order.paymentStatus = "Refunded";
    }
    await order.save();

    return { order, item };
};


export const declineItemReturn = async (orderId, itemId, declineReason = "") => {
    const order = await findOrderById(orderId);
    if (!order) {
        throw new Error("Order not found.");
    }
    const item = order.items.id(itemId) || order.items.find(i => i._id.toString() === itemId.toString());
    if (!item) {
        throw new Error("Timepiece item not found in order.");
    }
    if (item.status !== "Return Requested") {
        throw new Error("Timepiece item is not in Return Requested state.");
    }

    const now = new Date();
    item.status = "Delivered";
    item.returnDeclined = true;
    item.returnDeclinedAt = now;
    item.returnProcessedAt = now;
    if (declineReason) item.returnAdminNotes = `Decline Reason: ${declineReason.trim()}`;

    const activeItems = order.items.filter(i => i.status !== "Cancelled" && i.status !== "Returned");
    if (activeItems.length > 0 && activeItems.every(i => i.returnDeclined)) {
        order.returnDeclined = true;
        order.returnDeclinedAt = now;
    }

    syncOrderStatusFromItems(order);
    await order.save();

    return { order, item };
};
