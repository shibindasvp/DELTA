import {
    getBrandsList,
    getBrandStats,
    addBrand,
    editBrand,
    deleteBrand,
    permanentDeleteBrand,
    permanentDeleteAllArchivedBrands,
    restoreBrand,
    toggleBrand
} from "../../services/admin/brand.service.js";
import { validateBrand } from "../../validations/brand.validation.js";
import { respondWithError } from "../../utils/error.js";

const buildBrandRedirectUrl = (req, extra = "") => {
    const search = req.query.search || "";
    const status = req.query.status || "all";
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    return `/admin/brands?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}${extra}`;
};

export const showBrands = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const status = req.query.status || "all";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const [{ brands, pagination }, stats] = await Promise.all([
            getBrandsList({ search, status, page, limit }),
            getBrandStats()
        ]);

        const flashSuccess = req.query.added === "true"
            ? "New Manufacture Maison has been registered successfully."
            : req.query.updated === "true"
            ? "Maison details have been updated successfully."
            : req.query.deleted === "true"
            ? "Brand deleted successfully (moved to archive)."
            : req.query.purged === "true"
            ? "Brand permanently deleted successfully."
            : req.query.purgedAll === "true"
            ? "All archived brands permanently deleted successfully."
            : req.query.restored === "true"
            ? "Maison has been restored back to the catalog."
            : req.query.toggled === "true"
            ? "Maison listing status updated successfully."
            : null;

        const flashError = req.query.error || null;

        res.render("admin/brands/index", {
            brands,
            pagination,
            search,
            status,
            stats,
            success: flashSuccess,
            error: flashError,
            activePage: "brands",
            admin: req.admin || res.locals.currentAdmin
        });
    } catch (error) {
        next(error);
    }
};

export const addBrandHandler = async (req, res, next) => {
    const isAjax = req.xhr || req.headers.accept?.includes("json") || req.is("json");
    try {
        const errors = validateBrand(req.body);
        const search = req.query.search || "";
        const status = req.query.status || "all";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;

        if (Object.keys(errors).length > 0) {
            const errorMsg = Object.values(errors).join(" ");
            if (isAjax) {
                return res.status(400).json({
                    success: false,
                    errors,
                    message: Object.values(errors)[0] || errorMsg
                });
            }
            return res.redirect(`/admin/brands?error=${encodeURIComponent(errorMsg)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}&openAdd=true`);
        }

        const brand = await addBrand({
            name: req.body.name,
            origin: req.body.origin,
            foundedYear: req.body.foundedYear,
            description: req.body.description,
            website: req.body.website,
            isActive: req.body.isActive === "true" || req.body.isActive === true || req.body.isActive === "on"
        });

        if (isAjax) {
            return res.json({
                success: true,
                message: `Maison "${brand.name}" registered successfully.`,
                brand
            });
        }

        res.redirect(`/admin/brands?added=true&status=${encodeURIComponent(status)}&limit=${limit}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to add brand. Please check your entries and try again.",
            redirectUrl: isAjax ? null : buildBrandRedirectUrl(req, "&openAdd=true")
        });
    }
};

export const editBrandHandler = async (req, res, next) => {
    const isAjax = req.xhr || req.headers.accept?.includes("json") || req.is("json");
    try {
        const { id } = req.params;
        const errors = validateBrand(req.body);
        const search = req.query.search || "";
        const status = req.query.status || "all";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;

        if (Object.keys(errors).length > 0) {
            const errorMsg = Object.values(errors).join(" ");
            if (isAjax) {
                return res.status(400).json({
                    success: false,
                    errors,
                    message: Object.values(errors)[0] || errorMsg
                });
            }
            return res.redirect(`/admin/brands?error=${encodeURIComponent(errorMsg)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
        }

        const updated = await editBrand(id, {
            name: req.body.name,
            origin: req.body.origin,
            foundedYear: req.body.foundedYear,
            description: req.body.description,
            website: req.body.website,
            isActive: req.body.isActive === "true" || req.body.isActive === true || req.body.isActive === "on"
        });

        if (isAjax) {
            return res.json({
                success: true,
                message: `Maison "${updated.name}" updated successfully.`,
                brand: updated
            });
        }

        res.redirect(`/admin/brands?updated=true&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to update brand. Please verify your entries and try again.",
            redirectUrl: isAjax ? null : buildBrandRedirectUrl(req)
        });
    }
};

export const deleteBrandHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const search = req.query.search || "";
        const status = req.query.status || "all";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;

        await deleteBrand(id);

        res.redirect(`/admin/brands?deleted=true&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to archive brand.",
            redirectUrl: buildBrandRedirectUrl(req)
        });
    }
};

export const permanentDeleteBrandHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const search = req.query.search || "";
        const status = req.query.status || "archived";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;

        await permanentDeleteBrand(id);

        if (req.xhr || req.headers.accept?.includes("json")) {
            const stats = await getBrandStats();
            return res.json({
                success: true,
                stats,
                message: "Maison has been permanently deleted from archive."
            });
        }

        res.redirect(`/admin/brands?purged=true&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to permanently delete archived brand.",
            redirectUrl: buildBrandRedirectUrl({ query: { ...req.query, status: req.query.status || "archived" } })
        });
    }
};

export const permanentDeleteAllArchivedBrandsHandler = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const status = req.query.status || "archived";
        const limit = req.query.limit || 10;

        const { deletedCount, deletedBrandNames } = await permanentDeleteAllArchivedBrands();

        if (req.xhr || req.headers.accept?.includes("json")) {
            const stats = await getBrandStats();
            return res.json({
                success: true,
                deletedCount,
                deletedBrandNames,
                stats,
                message: deletedCount > 0 
                    ? `Successfully purged ${deletedCount} archived Maison(s) permanently.` 
                    : "No archived Maisons found to purge."
            });
        }

        res.redirect(`/admin/brands?purgedAll=true&deletedCount=${deletedCount}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=1&limit=${limit}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to purge archived brands.",
            redirectUrl: buildBrandRedirectUrl({ query: { ...req.query, status: req.query.status || "archived" } })
        });
    }
};

export const restoreBrandHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const search = req.query.search || "";
        const status = req.query.status || "archived";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;

        await restoreBrand(id);

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({
                success: true,
                message: "Maison has been restored back to the catalog."
            });
        }

        res.redirect(`/admin/brands?restored=true&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to restore archived brand.",
            redirectUrl: buildBrandRedirectUrl({ query: { ...req.query, status: req.query.status || "archived" } })
        });
    }
};

export const toggleBrandStatusHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const search = req.query.search || "";
        const status = req.query.status || "all";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;

        const updatedBrand = await toggleBrand(id);

        if (req.xhr || req.headers.accept?.includes("json")) {
            const stats = await getBrandStats();
            return res.json({
                success: true,
                isActive: updatedBrand.isActive,
                brandId: updatedBrand._id,
                stats,
                message: `Brand "${updatedBrand.name}" is now ${updatedBrand.isActive ? 'Active (Listed)' : 'Inactive (Unlisted)'}.`
            });
        }

        res.redirect(`/admin/brands?toggled=true&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to update brand listing status.",
            redirectUrl: buildBrandRedirectUrl(req)
        });
    }
};
