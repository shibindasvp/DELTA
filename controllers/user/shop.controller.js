import { getShopProducts, getProductDetail } from "../../services/user/shop.service.js";
import { getProductReviews } from "../../services/user/review.service.js";
import { isAjaxRequest, normalizeError } from "../../utils/error.js";

export const showShop = async (req, res, next) => {
    try {
        const {
            search = "",
            brand = "",
            material = "",
            priceMin = "",
            priceMax = "",
            inStockOnly = false,
            sort = "newest",
            page = 1,
            limit = 12
        } = req.query;

        const shopData = await getShopProducts({
            search,
            brand,
            material,
            priceMin,
            priceMax,
            inStockOnly,
            sort,
            page,
            limit
        });

        if (req.xhr || req.headers?.accept?.includes("json") || req.query.ajax === "true") {
            return res.json({
                success: true,
                products: shopData.products,
                pagination: shopData.pagination,
                filterData: shopData.filterData,
                query: shopData.query
            });
        }

        res.render("user/shop/index", {
            products: shopData.products,
            pagination: shopData.pagination,
            filterData: shopData.filterData,
            query: shopData.query,
            user: req.user || res.locals.currentUser || null,
            error: req.query?.error || null,
            success: req.query?.success || null,
            title: "Haute Horlogerie Catalog — DELTA Precision Timepieces"
        });
    } catch (error) {
        if (isAjaxRequest(req)) {
            const { statusCode, message } = normalizeError(error, "Unable to load catalog products right now.");
            return res.status(statusCode).json({ success: false, message });
        }
        next(error);
    }
};

export const showProductDetail = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const result = await getProductDetail(slug);

        if (!result || !result.product) {
            return res.redirect("/shop?error=" + encodeURIComponent("The requested timepiece could not be found."));
        }

        const currentUserId = req.user?.userId || req.user?._id || res.locals?.currentUser?.userId || res.locals?.currentUser?._id || null;
        const reviewData = await getProductReviews(result.product._id, currentUserId);

        res.render("user/shop/detail", {
            product: result.product,
            relatedProducts: result.relatedProducts,
            isUnavailable: result.isUnavailable,
            unavailableReason: result.unavailableReason,
            reviews: reviewData.reviews,
            reviewStats: reviewData.stats,
            userReview: reviewData.userReview,
            hasPurchased: reviewData.hasPurchased,
            error: req.query?.error || null,
            success: req.query?.success || null,
            user: req.user || res.locals?.currentUser || null,
            title: `${result.product.name} — ${result.product.brandName || 'DELTA'}`
        });
    } catch (error) {
        next(error);
    }
};
