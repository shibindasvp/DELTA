import { 
    getCheckoutDetails, 
    placeOrder, 
    getOrderById,
    getUserOrders,
    cancelFullOrder,
    cancelOrderItem,
    requestOrderReturn,
    requestOrderItemReturn
} from "../../services/user/checkout.service.js";
import { applyCartCoupon, removeCartCoupon } from "../../services/user/cart.service.js";
import { getWalletBalance } from "../../services/user/wallet.service.js";
import {
    initiateRazorpayOrder,
    verifyAndCompleteRazorpayOrder,
    recordFailedPaymentOrder,
    retryOrderPayment,
    verifyRetryPayment
} from "../../services/user/payment.service.js";
import { generateOrderInvoicePdf } from "../../helpers/invoice.helper.js";
import Order from "../../models/order.model.js";
import { 
    getDeclineCooldownForOrder, 
    getDeclineCooldownForProduct 
} from "../../services/user/cooldown.service.js";
import { isAjaxRequest, normalizeError, respondWithError } from "../../utils/error.js";

export const showCheckout = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.userId;
        const checkoutData = await getCheckoutDetails(userId);

        if (checkoutData.isEmpty) {
            return res.redirect("/cart?empty=true");
        }

        if (checkoutData.hasStockIssue) {
            return res.redirect(`/cart?error=${encodeURIComponent(checkoutData.stockIssueMessage)}`);
        }

        const query = req.query || {};

        if (req.session) {
            req.session.appliedCoupon = checkoutData.appliedCoupon || null;
            req.session.appliedCoupons = checkoutData.appliedCoupons || [];
        }

        res.render("user/checkout/index", {
            cart: checkoutData.cart,
            appliedCoupon: checkoutData.appliedCoupon || null,
            appliedCoupons: checkoutData.appliedCoupons || [],
            couponWarnings: checkoutData.couponWarnings || [],
            addresses: checkoutData.addresses,
            defaultAddress: checkoutData.defaultAddress,
            summary: checkoutData.summary,
            walletBalance: checkoutData.walletBalance || 0,
            wallet: checkoutData.wallet || { balance: 0, currency: "INR" },
            error: query.error || null,
            success: query.success || null,
            user: req.user || res.locals.currentUser,
            title: "Secure Checkout — DELTA"
        });
    } catch (error) {
        next(error);
    }
};

export const placeOrderHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { addressId, paymentMethod = "Cash on Delivery", notes = "" } = req.body;

        const order = await placeOrder({
            userId,
            addressId,
            paymentMethod,
            notes
        });

        if (req.xhr || req.headers?.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: "Your timepiece order has been confirmed.",
                orderId: order._id,
                orderNumber: order.orderNumber,
                redirect: `/order/success/${order._id}`
            });
        }

        return res.redirect(`/order/success/${order._id}`);
    } catch (error) {
        if (error && (error.code === "COUPON_BLOCKED" || error.code === "COUPON_REMOVED") && isAjaxRequest(req)) {
            return sendCouponInvalidatedJson(req, res, error);
        }
        return respondWithError(req, res, error, {
            fallback: "Unable to place your order. Please verify your delivery address and items and try again.",
            redirectUrl: "/checkout"
        });
    }
};

async function sendCouponInvalidatedJson(req, res, error) {
    let couponUpdate = null;
    try {
        const userId = req.user?._id || req.user?.userId;
        if (userId) {
            const refreshed = await getCheckoutDetails(userId);
            if (req.session) {
                req.session.appliedCoupon = refreshed.appliedCoupon || null;
                req.session.appliedCoupons = refreshed.appliedCoupons || [];
            }
            couponUpdate = {
                summary: refreshed.summary,
                appliedCoupon: refreshed.appliedCoupon || null,
                appliedCoupons: refreshed.appliedCoupons || []
            };
        }
    } catch (refreshErr) {}

    return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message,
        couponUpdate
    });
}

export const showOrderSuccess = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;

        const order = await getOrderById(id, userId);

        res.render("user/checkout/success", {
            order,
            user: req.user || res.locals.currentUser,
            title: `Order Confirmed — ${order.orderNumber} | DELTA`
        });
    } catch (error) {
        next(error);
    }
};

export const showOrderFailure = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;

        let order = null;
        if (id) {
            try {
                order = await getOrderById(id, userId);
            } catch (e) {
            }
        }

        if (!order) {
            order = await Order.findOne({ user: userId, paymentStatus: { $in: ["Failed", "Pending"] } })
                .sort({ createdAt: -1 });
        }

        const reason = req.query.reason || (order && order.paymentFailureReason) || "Payment authorization was declined or cancelled.";
        const [walletBalance, cooldown] = await Promise.all([
            getWalletBalance(userId).catch(() => 0),
            order ? getDeclineCooldownForOrder(order) : { inCooldown: false, remainingSeconds: 0 }
        ]);

        res.render("user/checkout/failure", {
            order,
            reason,
            cooldown,
            walletBalance: walletBalance || 0,
            user: req.user || res.locals.currentUser,
            title: order ? `Payment Incomplete — ${order.orderNumber} | DELTA` : "Payment Authorization Failed | DELTA"
        });
    } catch (error) {
        next(error);
    }
};

export const showOrderDetails = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;

        const [order, walletBalance] = await Promise.all([
            getOrderById(id, userId),
            getWalletBalance(userId).catch(() => 0)
        ]);

        const query = req.query || {};
        let success = null;
        let error = query.error || null;

        if (query.cancelled === "true") {
            success = "Your order has been successfully cancelled and stock restored.";
        } else if (query.itemCancelled === "true") {
            success = "The selected timepiece has been cancelled and stock restored.";
        } else if (query.returnRequested === "true") {
            success = "Your return request has been submitted. Our concierge team will review it shortly.";
        } else if (query.itemReturnRequested === "true") {
            success = "Your return request for this timepiece has been submitted.";
        } else if (query.success) {
            success = query.success;
        }

        const cooldown = (order && order.paymentStatus === "Failed") 
            ? getDeclineCooldownForOrder(order) 
            : { inCooldown: false, remainingSeconds: 0 };

        res.render("user/orders/detail", {
            order,
            walletBalance,
            cooldown,
            success,
            error,
            user: req.user || res.locals.currentUser,
            title: `Order Dossier — ${order.orderNumber} | DELTA Vault`
        });
    } catch (error) {
        next(error);
    }
};

export const showUserOrders = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.userId;
        const query = req.query || {};
        const search = query.search || "";
        const status = query.status || "";

        const orders = await getUserOrders({ userId, search, status });

        if (req.xhr || req.headers?.accept?.includes("json") || query.ajax === "true") {
            return res.json({
                success: true,
                orders,
                search,
                status
            });
        }

        let success = null;
        let error = query.error || null;

        if (query.cancelled === "true") {
            success = "Your order has been cancelled and stock restored.";
        } else if (query.success) {
            success = query.success;
        }

        res.render("user/orders/index", {
            orders,
            search,
            status,
            success,
            error,
            user: req.user || res.locals.currentUser,
            title: "My Orders — DELTA Vault"
        });
    } catch (error) {
        if (isAjaxRequest(req)) {
            const { statusCode, message } = normalizeError(error, "Unable to load your orders right now.");
            return res.status(statusCode).json({ success: false, message });
        }
        next(error);
    }
};

export const cancelOrderHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;
        const { reason = "" } = req.body;

        const order = await cancelFullOrder({
            userId,
            orderId: id,
            reason
        });

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: `Order ${order.orderNumber} has been cancelled and stock returned to vault.`,
                order
            });
        }

        return res.redirect(`/order/details/${order._id}?cancelled=true`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Unable to cancel order right now.",
            redirectUrl: `/order/details/${req.params.id}`
        });
    }
};

export const cancelOrderItemHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id, itemId } = req.params;
        const { reason = "" } = req.body;

        const { order, cancelledItem } = await cancelOrderItem({
            userId,
            orderId: id,
            itemId,
            reason
        });

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: `Timepiece "${cancelledItem.productName}" cancelled and stock returned to vault.`,
                order
            });
        }

        return res.redirect(`/order/details/${order._id}?itemCancelled=true`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Unable to cancel timepiece item.",
            redirectUrl: `/order/details/${req.params.id}`
        });
    }
};

export const returnOrderHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;
        const { reason } = req.body;

        const order = await requestOrderReturn({
            userId,
            orderId: id,
            reason
        });

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: `Return request submitted for order ${order.orderNumber}. Private concierge will contact you.`,
                order
            });
        }

        return res.redirect(`/order/details/${order._id}?returnRequested=true`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Unable to submit return request right now.",
            redirectUrl: `/order/details/${req.params.id}`
        });
    }
};

export const returnOrderItemHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id, itemId } = req.params;
        const { reason } = req.body;

        const { order, item } = await requestOrderItemReturn({
            userId,
            orderId: id,
            itemId,
            reason
        });

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: `Return request submitted for "${item.productName}". Private concierge will contact you.`,
                order,
                item
            });
        }

        return res.redirect(`/order/details/${order._id}?itemReturnRequested=true`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Unable to submit return request for this item.",
            redirectUrl: `/order/details/${req.params.id}`
        });
    }
};

export const downloadOrderInvoiceHandler = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;

        const order = await getOrderById(id, userId);
        generateOrderInvoicePdf(order, res);
    } catch (error) {
        next(error);
    }
};


export const initiateRazorpayOrderHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { addressId } = req.body;

        const result = await initiateRazorpayOrder({ userId, addressId });
        return res.json(result);
    } catch (error) {
        if (error && (error.code === "COUPON_BLOCKED" || error.code === "COUPON_REMOVED")) {
            return sendCouponInvalidatedJson(req, res, error);
        }
        const { statusCode, message } = normalizeError(error, "Failed to initialize Razorpay checkout session. Please try again.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};

export const verifyRazorpayPaymentHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const {
            addressId,
            notes,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const result = await verifyAndCompleteRazorpayOrder({
            userId,
            addressId,
            notes,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        });

        return res.json(result);
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Razorpay payment verification failed. Please contact support if your card was charged.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};


export const recordPaymentFailureHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const {
            addressId,
            notes,
            paymentMethod,
            failureReason,
            razorpayOrderId,
            paypalOrderId
        } = req.body;

        const result = await recordFailedPaymentOrder({
            userId,
            addressId,
            notes,
            paymentMethod,
            failureReason,
            razorpayOrderId,
            paypalOrderId
        });

        return res.json(result);
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Could not record payment failure state.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};


export const retryOrderPaymentHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;
        const { paymentMethod = "Razorpay" } = req.body;

        const result = await retryOrderPayment({
            userId,
            orderId: id,
            paymentMethod
        });

        return res.json(result);
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Failed to initialize payment retry session.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};

export const verifyRetryPaymentHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;
        const {
            paymentMethod = "Razorpay",
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            paypalOrderId
        } = req.body;

        const result = await verifyRetryPayment({
            userId,
            orderId: id,
            paymentMethod,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            paypalOrderId
        });

        return res.json(result);
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Failed to verify retry payment. Please try again.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};


export const recordOrderDeclineHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;
        const order = await Order.findOne({ _id: id, user: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }
        order.paymentStatus = "Failed";
        order.declinedAt = new Date();
        if (req.body.reason) {
            order.paymentFailureReason = req.body.reason;
        }
        await order.save();
        return res.json({
            success: true,
            message: "Decline recorded. 5-minute re-buy cooldown active.",
            declinedAt: order.declinedAt,
            cooldownSeconds: 300
        });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Unable to record payment decline.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};


export const getOrderCooldownHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { id } = req.params;
        const order = await Order.findOne({ _id: id, user: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }
        const cd = getDeclineCooldownForOrder(order);
        return res.json({ success: true, ...cd });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Unable to check order cooldown status.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};


export const getProductCooldownHandler = async (req, res) => {
    try {
        const userId = req.user ? (req.user._id || req.user.userId) : null;
        const { id } = req.params;
        if (!userId) {
            return res.json({ success: true, inCooldown: false, remainingSeconds: 0 });
        }
        const cd = await getDeclineCooldownForProduct(userId, id);
        return res.json({ success: true, ...cd });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Unable to check product cooldown status.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};


export const applyCheckoutCouponHandler = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Please sign in to redeem a coupon." });
        }

        const userId = req.user._id || req.user.userId;
        const { code } = req.body;

        const result = await applyCartCoupon({ userId, code });
        if (req.session) {
            req.session.appliedCoupon = result.coupon;
            req.session.appliedCoupons = result.appliedCoupons;
        }

        return res.json({
            success: true,
            message: `Coupon code "${result.coupon.code}" applied successfully.`,
            coupon: result.coupon,
            appliedCoupons: result.appliedCoupons,
            summary: {
                originalSubtotal: result.originalSubtotal || result.subtotal,
                productDiscount: result.productDiscount || 0,
                subtotal: result.subtotal,
                discount: result.discountAmount,
                totalSavings: result.totalSavings || result.discountAmount,
                grandTotal: result.grandTotal,
                tax: Math.round(result.subtotal * 0.18),
                shipping: 0
            }
        });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Failed to apply coupon code. Please verify it and try again.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};


export const removeCheckoutCouponHandler = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Please sign in." });
        }

        const userId = req.user._id || req.user.userId;
        const { code } = req.body || {};

        const result = await removeCartCoupon({ userId, code });
        if (req.session) {
            req.session.appliedCoupon = result.appliedCoupon;
            req.session.appliedCoupons = result.appliedCoupons;
        }

        return res.json({
            success: true,
            message: code ? `Coupon code "${code}" removed from your order.` : "Coupon code removed from your order.",
            appliedCoupons: result.appliedCoupons,
            appliedCoupon: result.appliedCoupon,
            summary: {
                originalSubtotal: result.originalSubtotal || result.subtotal,
                productDiscount: result.productDiscount || 0,
                subtotal: result.subtotal,
                discount: result.discountAmount,
                totalSavings: result.totalSavings || 0,
                grandTotal: result.grandTotal,
                tax: Math.round(result.subtotal * 0.18),
                shipping: 0
            }
        });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Failed to remove coupon code.", 400);
        return res.status(statusCode).json({ success: false, message });
    }
};
