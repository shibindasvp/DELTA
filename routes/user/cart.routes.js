import express from "express";
import {
    showCart,
    addToCartHandler,
    updateQuantityHandler,
    removeItemHandler,
    getCartCountApi,
    getAvailableCouponsApi
} from "../../controllers/user/cart.controller.js";
import { isAuthenticated, optionalAuth } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/cart", isAuthenticated, showCart);
router.post("/cart/add", isAuthenticated, addToCartHandler);
router.post("/cart/update", isAuthenticated, updateQuantityHandler);
router.post("/cart/remove", isAuthenticated, removeItemHandler);
router.get("/api/cart/count", optionalAuth, getCartCountApi);
router.get("/api/coupons/available", optionalAuth, getAvailableCouponsApi);

export default router;
