import express from "express";
import { showShop, showProductDetail } from "../../controllers/user/shop.controller.js";
import { addReviewHandler, deleteReviewHandler } from "../../controllers/user/review.controller.js";
import { optionalAuth, isAuthenticated } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/shop", optionalAuth, showShop);
router.get("/products", optionalAuth, showShop);
router.get("/product/:slug", optionalAuth, showProductDetail);
router.get("/shop/:slug", optionalAuth, showProductDetail);

router.post("/product/:slug/reviews", isAuthenticated, addReviewHandler);
router.post("/shop/:slug/reviews", isAuthenticated, addReviewHandler);
router.delete("/product/:slug/reviews/:reviewId", isAuthenticated, deleteReviewHandler);
router.post("/product/:slug/reviews/:reviewId/delete", isAuthenticated, deleteReviewHandler);

export default router;
