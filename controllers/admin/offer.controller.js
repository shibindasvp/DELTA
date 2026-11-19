import {
    getOffersList,
    getOfferById,
    createOffer,
    updateOffer,
    toggleOfferStatus,
    deleteOffer
} from "../../services/admin/offer.service.js";
import { validateOffer } from "../../validations/offer.validation.js";
import { normalizeError, respondWithError } from "../../utils/error.js";


export const showOffers = async (req, res, next) => {
    try {
        const {
            search = "",
            type = "all",
            status = "all",
            sort = "newest",
            page = 1,
            limit = 10
        } = req.query;

        const parsedPage = parseInt(page, 10) || 1;
        const parsedLimit = parseInt(limit, 10) || 10;

        const result = await getOffersList({
            search,
            type,
            status,
            sort,
            page: parsedPage,
            limit: parsedLimit
        });

        if (req.xhr || req.headers.accept?.includes("json") || req.query.ajax === "true") {
            return res.json({
                success: true,
                ...result,
                search,
                type,
                status,
                sort,
                page: parsedPage,
                limit: parsedLimit
            });
        }

        const query = req.query || {};
        let success = query.success || null;
        let error = query.error || null;

        if (success === "created") success = "Offer created successfully.";
        if (success === "updated") success = "Offer updated successfully.";
        if (success === "deleted") success = "Offer deleted successfully.";
        if (success === "activated") success = "Offer activated successfully.";
        if (success === "paused") success = "Offer paused successfully.";

        res.render("admin/offers/index", {
            offers: result.offers,
            allProducts: result.allProducts,
            allBrands: result.allBrands,
            stats: result.stats,
            pagination: result.pagination,
            search,
            type,
            status,
            sort,
            page: parsedPage,
            limit: parsedLimit,
            success,
            error,
            activePage: "offers",
            adminUser: req.admin || { name: "Vault Curator", role: "Administrator" }
        });
    } catch (error) {
        next(error);
    }
};


export const getOfferDetailApi = async (req, res) => {
    try {
        const offer = await getOfferById(req.params.id);
        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found." });
        }
        return res.json({ success: true, offer });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Unable to load offer details.");
        return res.status(statusCode).json({ success: false, message });
    }
};


export const createOfferHandler = async (req, res) => {
    try {
        const errors = validateOffer(req.body);
        if (Object.keys(errors).length > 0) {
            const firstError = Object.values(errors)[0];
            if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
                return res.status(400).json({
                    success: false,
                    message: firstError,
                    errors
                });
            }
            return res.redirect(`/admin/offers?error=${encodeURIComponent(firstError)}&openAdd=true`);
        }

        const {
            name,
            description,
            offerType,
            discountPercentage,
            productId,
            brandId,
            startDate,
            endDate
        } = req.body;

        const offer = await createOffer({
            name,
            description,
            offerType,
            discountPercentage,
            productId,
            brandId,
            startDate,
            endDate
        });

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: "Offer created successfully.",
                offer
            });
        }

        return res.redirect("/admin/offers?success=created");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to create offer. Please check your entries and try again.",
            redirectUrl: "/admin/offers?openAdd=true"
        });
    }
};


export const updateOfferHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const errors = validateOffer(req.body, { isUpdate: true });
        if (Object.keys(errors).length > 0) {
            const firstError = Object.values(errors)[0];
            if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
                return res.status(400).json({
                    success: false,
                    message: firstError,
                    errors
                });
            }
            return res.redirect(`/admin/offers?error=${encodeURIComponent(firstError)}`);
        }

        const offer = await updateOffer(id, req.body);

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: "Offer updated successfully.",
                offer
            });
        }

        return res.redirect("/admin/offers?success=updated");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to update offer. Please check your entries and try again.",
            redirectUrl: "/admin/offers"
        });
    }
};


export const toggleOfferStatusHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await toggleOfferStatus(id);

        const statusMsg = offer.isActive ? "Offer activated successfully." : "Offer paused successfully.";

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({
                success: true,
                message: statusMsg,
                offer
            });
        }

        return res.redirect(`/admin/offers?success=${offer.isActive ? "activated" : "paused"}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to toggle offer status.",
            redirectUrl: "/admin/offers"
        });
    }
};


export const deleteOfferHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await deleteOffer(id);

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({
                success: true,
                message: "Offer deleted successfully.",
                offer
            });
        }

        return res.redirect("/admin/offers?success=deleted");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to delete offer.",
            redirectUrl: "/admin/offers"
        });
    }
};
