import {
    getCouponsList,
    getCouponById,
    createCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon
} from "../../services/admin/coupon.service.js";
import { isAjaxRequest, normalizeError, respondWithError } from "../../utils/error.js";


export const showCoupons = async (req, res, next) => {
    try {
        const {
            search = "",
            status = "all",
            discountType = "all",
            sort = "newest",
            page = 1,
            limit = 10
        } = req.query;

        const parsedPage = parseInt(page, 10) || 1;
        const parsedLimit = parseInt(limit, 10) || 10;

        const result = await getCouponsList({
            search,
            status,
            discountType,
            sort,
            page: parsedPage,
            limit: parsedLimit
        });

        if (req.xhr || req.headers.accept?.includes("json") || req.query.ajax === "true") {
            return res.json({
                success: true,
                ...result,
                search,
                status,
                discountType,
                sort,
                page: parsedPage,
                limit: parsedLimit
            });
        }

        const query = req.query || {};
        let success = query.success || null;
        let error = query.error || null;

        if (success === "created") success = "Coupon created successfully.";
        if (success === "updated") success = "Coupon updated successfully.";
        if (success === "deleted") success = "Coupon deleted successfully.";

        res.render("admin/coupons/index", {
            coupons: result.coupons,
            stats: result.stats,
            pagination: result.pagination,
            search,
            status,
            discountType,
            sort,
            page: parsedPage,
            limit: parsedLimit,
            success,
            error,
            admin: req.admin || res.locals?.currentAdmin || null,
            activePage: "coupons",
            title: "Coupon Management — DELTA Vault"
        });
    } catch (error) {
        if (isAjaxRequest(req)) {
            const { statusCode, message } = normalizeError(error, "Unable to load coupons list.");
            return res.status(statusCode).json({ success: false, message });
        }
        next(error);
    }
};


export const getCouponDetailApi = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await getCouponById(id);
        return res.json({ success: true, coupon });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Coupon not found or invalid ID.", 404);
        return res.status(statusCode).json({ success: false, message });
    }
};


export const createCouponHandler = async (req, res) => {
    try {
        const {
            code,
            description,
            discountType,
            discountValue,
            minPurchaseAmount,
            maxDiscountAmount,
            expiryDate,
            usageLimit,
            isActive
        } = req.body;

        const coupon = await createCoupon({
            code,
            description,
            discountType,
            discountValue,
            minPurchaseAmount,
            maxDiscountAmount,
            expiryDate,
            usageLimit,
            isActive: isActive === "on" || isActive === true || isActive === "true"
        });

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.status(201).json({
                success: true,
                message: `Coupon code "${coupon.code}" created successfully.`,
                coupon
            });
        }

        return res.redirect("/admin/coupons?success=created");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to create coupon. Please review your entries and try again.",
            redirectUrl: "/admin/coupons"
        });
    }
};


export const updateCouponHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        if ("isActive" in updateData) {
            updateData.isActive = updateData.isActive === "on" || updateData.isActive === true || updateData.isActive === "true";
        }

        const updatedCoupon = await updateCoupon(id, updateData);

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: `Coupon code "${updatedCoupon.code}" updated successfully.`,
                coupon: updatedCoupon
            });
        }

        return res.redirect("/admin/coupons?success=updated");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to update coupon. Please review your entries and try again.",
            redirectUrl: "/admin/coupons"
        });
    }
};


export const toggleCouponStatusHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await toggleCouponStatus(id);

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: `Coupon code "${coupon.code}" is now ${coupon.isActive ? "Active" : "Inactive"}.`,
                isActive: coupon.isActive,
                coupon
            });
        }

        return res.redirect(`/admin/coupons?success=${encodeURIComponent(`Coupon status changed to ${coupon.isActive ? "Active" : "Inactive"}`)}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to toggle coupon status.",
            redirectUrl: "/admin/coupons"
        });
    }
};


export const deleteCouponHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCoupon = await deleteCoupon(id);

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: `Coupon code "${deletedCoupon.code}" deleted successfully.`,
                coupon: deletedCoupon
            });
        }

        return res.redirect("/admin/coupons?success=deleted");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to delete coupon.",
            redirectUrl: "/admin/coupons"
        });
    }
};
