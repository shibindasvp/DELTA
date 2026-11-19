import express from "express";
import {
    showCheckout,
    placeOrderHandler,
    showOrderSuccess,
    showOrderFailure,
    showOrderDetails,
    showUserOrders,
    cancelOrderHandler,
    cancelOrderItemHandler,
    returnOrderHandler,
    returnOrderItemHandler,
    downloadOrderInvoiceHandler,
    initiateRazorpayOrderHandler,
    verifyRazorpayPaymentHandler,
    recordPaymentFailureHandler,
    retryOrderPaymentHandler,
    verifyRetryPaymentHandler,
    recordOrderDeclineHandler,
    getOrderCooldownHandler,
    getProductCooldownHandler,
    applyCheckoutCouponHandler,
    removeCheckoutCouponHandler
} from "../../controllers/user/checkout.controller.js";
import { isAuthenticated, preventCache } from "../../middlewares/auth.middleware.js";

const router = express.Router();


router.get("/checkout", isAuthenticated, preventCache, showCheckout);
router.post("/checkout/place-order", isAuthenticated, placeOrderHandler);

router.post("/checkout/apply-coupon", isAuthenticated, applyCheckoutCouponHandler);
router.post("/checkout/remove-coupon", isAuthenticated, removeCheckoutCouponHandler);
router.post("/checkout/coupon/apply", isAuthenticated, applyCheckoutCouponHandler);
router.post("/checkout/coupon/remove", isAuthenticated, removeCheckoutCouponHandler);

router.post("/checkout/razorpay/create-order", isAuthenticated, initiateRazorpayOrderHandler);
router.post("/checkout/razorpay/verify-payment", isAuthenticated, verifyRazorpayPaymentHandler);
router.post("/checkout/payment-failed", isAuthenticated, recordPaymentFailureHandler);

router.post("/orders/:id/retry-payment", isAuthenticated, retryOrderPaymentHandler);
router.post("/order/:id/retry-payment", isAuthenticated, retryOrderPaymentHandler);
router.post("/orders/:id/verify-retry-payment", isAuthenticated, verifyRetryPaymentHandler);
router.post("/order/:id/verify-retry-payment", isAuthenticated, verifyRetryPaymentHandler);
router.post("/orders/:id/record-decline", isAuthenticated, recordOrderDeclineHandler);
router.post("/order/:id/record-decline", isAuthenticated, recordOrderDeclineHandler);
router.get("/api/orders/:id/decline-cooldown", isAuthenticated, getOrderCooldownHandler);
router.get("/api/products/:id/decline-cooldown", getProductCooldownHandler);

router.get("/order/success/:id", isAuthenticated, preventCache, showOrderSuccess);
router.get("/order-success/:id", isAuthenticated, preventCache, showOrderSuccess);
router.get("/checkout/payment-success/:id", isAuthenticated, preventCache, showOrderSuccess);
router.get("/payment/success/:id", isAuthenticated, preventCache, showOrderSuccess);

router.get("/checkout/payment-failed/:id", isAuthenticated, preventCache, showOrderFailure);
router.get("/checkout/payment-failed", isAuthenticated, preventCache, showOrderFailure);
router.get("/order/failed/:id", isAuthenticated, preventCache, showOrderFailure);
router.get("/order-failed/:id", isAuthenticated, preventCache, showOrderFailure);
router.get("/payment/failed/:id", isAuthenticated, preventCache, showOrderFailure);
router.get("/payment/failed", isAuthenticated, preventCache, showOrderFailure);
router.get("/payment-failure/:id", isAuthenticated, preventCache, showOrderFailure);
router.get("/payment-failure", isAuthenticated, preventCache, showOrderFailure);


router.get("/orders", isAuthenticated, preventCache, showUserOrders);
router.get("/profile/orders", isAuthenticated, preventCache, showUserOrders);


router.get("/order/details/:id", isAuthenticated, preventCache, showOrderDetails);
router.get("/orders/:id", isAuthenticated, preventCache, showOrderDetails);
router.get("/profile/orders/:id", isAuthenticated, preventCache, showOrderDetails);


router.post("/orders/:id/cancel", isAuthenticated, cancelOrderHandler);
router.post("/order/:id/cancel", isAuthenticated, cancelOrderHandler);
router.post("/orders/:id/items/:itemId/cancel", isAuthenticated, cancelOrderItemHandler);
router.post("/order/:id/items/:itemId/cancel", isAuthenticated, cancelOrderItemHandler);


router.post("/orders/:id/return", isAuthenticated, returnOrderHandler);
router.post("/order/:id/return", isAuthenticated, returnOrderHandler);
router.post("/orders/:id/items/:itemId/return", isAuthenticated, returnOrderItemHandler);
router.post("/order/:id/items/:itemId/return", isAuthenticated, returnOrderItemHandler);


router.get("/orders/:id/invoice", isAuthenticated, downloadOrderInvoiceHandler);
router.get("/order/:id/invoice", isAuthenticated, downloadOrderInvoiceHandler);

export default router;
