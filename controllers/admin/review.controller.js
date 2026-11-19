import {
    getAdminReviewsList,
    getReviewById,
    toggleReviewStatus,
    deleteReviewAdmin
} from "../../services/admin/review.service.js";
import { isAjaxRequest, normalizeError } from "../../utils/error.js";

export const showReviews = async (req, res, next) => {
    try {
        const {
            search = "",
            rating = "all",
            status = "all",
            verified = "all",
            sort = "newest",
            page = 1,
            limit = 10
        } = req.query;

        const parsedPage = parseInt(page, 10) || 1;
        const parsedLimit = parseInt(limit, 10) || 10;

        const result = await getAdminReviewsList({
            search,
            rating,
            status,
            verified,
            sort,
            page: parsedPage,
            limit: parsedLimit
        });

        if (req.xhr || req.headers.accept?.includes("json") || req.query.ajax === "true") {
            return res.json({
                success: true,
                ...result,
                search,
                rating,
                status,
                verified,
                sort,
                page: parsedPage,
                limit: parsedLimit
            });
        }

        const query = req.query || {};
        let success = query.success || null;
        let error = query.error || null;

        if (success === "toggled") success = "Review visibility status updated successfully.";
        if (success === "deleted") success = "Review deleted successfully.";

        res.render("admin/reviews/index", {
            reviews: result.reviews,
            stats: result.stats,
            pagination: result.pagination,
            search,
            rating,
            status,
            verified,
            sort,
            page: parsedPage,
            limit: parsedLimit,
            success,
            error,
            activePage: "reviews",
            adminUser: req.admin || { name: "Vault Curator", role: "Administrator" },
            title: "Collector Reviews Management — DELTA Maison"
        });
    } catch (error) {
        next(error);
    }
};

export const getReviewDetailApi = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await getReviewById(id);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }
        return res.json({ success: true, review });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Unable to load review details.");
        return res.status(statusCode).json({ success: false, message });
    }
};

export const toggleReviewStatusHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await toggleReviewStatus(id);

        const statusMsg = review.isActive
            ? "Review is now published and visible to collectors."
            : "Review has been hidden from public storefront.";

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: statusMsg,
                review
            });
        }

        return res.redirect("/admin/reviews?success=toggled");
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Failed to delete review.", 400);
        if (isAjaxRequest(req) || req.is("json")) {
            return res.status(statusCode).json({ success: false, message });
        }
        return res.redirect(`/admin/reviews?error=${encodeURIComponent(message)}`);
    }
};

export const deleteReviewHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await deleteReviewAdmin(id);

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: "Review deleted successfully.",
                review
            });
        }

        return res.redirect("/admin/reviews?success=deleted");
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Failed to delete review.", 400);
        if (isAjaxRequest(req) || req.is("json")) {
            return res.status(statusCode).json({ success: false, message });
        }
        return res.redirect(`/admin/reviews?error=${encodeURIComponent(message)}`);
    }
};
