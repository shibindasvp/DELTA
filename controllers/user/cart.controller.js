import Product from "../../models/product.model.js";
import Cart from "../../models/cart.model.js";
import {
    getUserCart,
    addToCart as addToCartService,
    updateCartItemQuantity,
    removeCartItem,
    getCartCount
} from "../../services/user/cart.service.js";
import { getAvailableCoupons } from "../../services/user/coupon.service.js";
import { formatErrorMessage, isAjaxRequest, normalizeError, respondWithError } from "../../utils/error.js";

export const showCart = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect("/login?redirect=/cart");
        }

        const userId = req.user._id || req.user.userId;
        const [cart, curatedProducts] = await Promise.all([
            getUserCart(userId),
            Product.find({ isDeleted: false, isActive: true }).populate("brand").limit(4).lean()
        ]);

        let success = req.query.added === "true" 
            ? "Timepiece added to your shopping bag." 
            : req.query.deleted === "true"
            ? "Timepiece removed from shopping bag."
            : req.query.success 
            ? req.query.success 
            : null;

        let error = req.query.empty === "true"
            ? "Your shopping bag is currently empty. Please select timepieces before proceeding to checkout."
            : (req.query.error || null);

        res.render("user/cart/index", {
            cart: {
                ...cart,
                finalTotal: cart.subtotal
            },
            curatedProducts,
            user: req.user || res.locals.currentUser,
            success,
            error,
            title: "Shopping Bag — DELTA Vault"
        });
    } catch (error) {
        next(error);
    }
};

export const addToCartHandler = async (req, res, next) => {
    try {
        if (!req.user) {
            if (req.xhr || req.headers.accept?.includes("json")) {
                return res.status(401).json({ 
                    success: false, 
                    message: "Please sign in to add timepieces to your collection bag.", 
                    redirect: "/login" 
                });
            }
            return res.redirect("/login?redirect=/shop");
        }

        const { productId, variantColor, variantId, quantity } = req.body;
        const updatedCart = await addToCartService({
            userId: (req.user._id || req.user.userId),
            productId,
            variantColor,
            variantId,
            quantity: parseInt(quantity, 10) || 1
        });

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({
                success: true,
                message: "Timepiece successfully added to your shopping bag.",
                cartCount: updatedCart.totalItemCount,
                cart: updatedCart
            });
        }

        res.redirect("/cart?added=true");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Unable to add timepiece to your shopping bag.",
            redirectUrl: "/shop"
        });
    }
};

export const updateQuantityHandler = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please sign in." });
        }

        const { itemId, action, quantity } = req.body;
        const updatedCart = await updateCartItemQuantity({
            userId: (req.user._id || req.user.userId),
            itemId,
            action,
            quantity
        });

        return res.json({
            success: true,
            cart: updatedCart,
            finalTotal: updatedCart.subtotal,
            message: "Quantity adjusted."
        });
    } catch (error) {
        const userId = req.user ? (req.user._id || req.user.userId) : null;
        let latestCart = null;
        if (userId) {
            try {
                latestCart = await getUserCart(userId);
            } catch (e) {}
        }
        const { statusCode, message } = normalizeError(error, "Unable to update item quantity.", 400);
        return res.status(statusCode).json({
            success: false,
            cart: latestCart,
            message
        });
    }
};

export const removeItemHandler = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const { itemId } = req.body;
        const updatedCart = await removeCartItem({
            userId: (req.user._id || req.user.userId),
            itemId
        });

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({
                success: true,
                message: "Timepiece removed from shopping bag.",
                cart: updatedCart,
                finalTotal: updatedCart.subtotal
            });
        }

        res.redirect("/cart?deleted=true");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Unable to remove item from your shopping bag.",
            redirectUrl: "/cart"
        });
    }
};

export const getCartCountApi = async (req, res) => {
    try {
        const count = req.user ? await getCartCount((req.user._id || req.user.userId)) : 0;
        return res.json({ count });
    } catch (error) {
        return res.json({ count: 0 });
    }
};

export const getAvailableCouponsApi = async (req, res) => {
    try {
        const userId = req.user ? (req.user._id || req.user.userId) : null;
        const cart = userId ? await getUserCart(userId) : null;
        const subtotal = cart ? cart.subtotal : 0;
        const coupons = await getAvailableCoupons(subtotal, userId);
        return res.json({ success: true, coupons, subtotal });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Unable to load available coupons right now.");
        return res.status(statusCode).json({ success: false, message });
    }
};
