import express from "express";
import { 
    showWishlist, 
    toggleWishlistHandler, 
    removeFromWishlistHandler,
    addAllWishlistToCartHandler,
    getWishlistIdsApi
} from "../../controllers/user/wishlist.controller.js";
import { isAuthenticated, optionalAuth } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/wishlist", isAuthenticated, showWishlist);
router.get("/private-collection", isAuthenticated, showWishlist);
router.post("/wishlist/toggle", isAuthenticated, toggleWishlistHandler);
router.post("/wishlist/remove", isAuthenticated, removeFromWishlistHandler);
router.post("/wishlist/add-all-to-cart", isAuthenticated, addAllWishlistToCartHandler);
router.get("/api/wishlist/ids", optionalAuth, getWishlistIdsApi);

export default router;
