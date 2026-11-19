import {
    getProductsList,
    getProductStats,
    getProductFormData,
    addProduct,
    editProduct,
    deleteProduct,
    restoreProduct,
    toggleProduct
} from "../../services/admin/product.service.js";
import { findProductById } from "../../repositories/product.repository.js";
import { getAllActiveBrands } from "../../repositories/brand.repository.js";
import { validateProduct } from "../../validations/product.validation.js";
import { formatErrorMessage } from "../../utils/error.js";

export const showProducts = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const brandId = req.query.brand || "";
        const status = req.query.status || "";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const [{ products, pagination }, stats, brands] = await Promise.all([
            getProductsList({ search, brandId, status, page, limit }),
            getProductStats(),
            getAllActiveBrands()
        ]);

        const flashSuccess = req.query.added === "true"
            ? "New timepiece has been cataloged in the vault."
            : req.query.updated === "true"
            ? "Timepiece specifications and variants have been updated."
            : req.query.deleted === "true"
            ? "Product deleted successfully (moved to archive)."
            : req.query.restored === "true"
            ? "Timepiece has been successfully restored and retrieved to the vault."
            : req.query.toggled === "true"
            ? "Product listing visibility updated."
            : null;

        const flashError = req.query.error || null;

        res.render("admin/products/index", {
            products,
            pagination,
            search,
            brandId,
            status,
            stats,
            brands,
            success: flashSuccess,
            error: flashError,
            activePage: "products",
            admin: req.admin || res.locals.currentAdmin
        });
    } catch (error) {
        next(error);
    }
};

export const showAddProduct = async (req, res, next) => {
    try {
        const { brands } = await getProductFormData();
        res.render("admin/products/add", {
            brands,
            errors: {},
            product: {},
            error: req.query.error || null,
            activePage: "products",
            admin: req.admin || res.locals.currentAdmin
        });
    } catch (error) {
        next(error);
    }
};

export const addProductHandler = async (req, res, next) => {
    try {
        if (req.fileValidationError) {
            const { brands } = await getProductFormData();
            return res.status(400).render("admin/products/add", {
                brands,
                errors: { images: req.fileValidationError },
                product: req.body,
                error: req.fileValidationError,
                activePage: "products",
                admin: req.admin || res.locals.currentAdmin
            });
        }

        const processedImages = req.processedImages || [];
        const errors = validateProduct(req.body, processedImages.length);

        if (Object.keys(errors).length > 0) {
            const { brands } = await getProductFormData();
            return res.status(400).render("admin/products/add", {
                brands,
                errors,
                product: req.body,
                error: Object.values(errors).join(" "),
                activePage: "products",
                admin: req.admin || res.locals.currentAdmin
            });
        }

        await addProduct(req.body, processedImages);

        res.redirect("/admin/products?added=true");
    } catch (error) {
        const message = formatErrorMessage(error, "Failed to add product. Please verify your entries and try again.");
        const { brands } = await getProductFormData().catch(() => ({ brands: [] }));
        res.status(400).render("admin/products/add", {
            brands,
            errors: { general: message },
            product: req.body,
            error: message,
            activePage: "products",
            admin: req.admin || res.locals.currentAdmin
        });
    }
};

export const showEditProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await findProductById(id);
        if (!product || product.isDeleted) {
            return res.redirect("/admin/products?error=Product+not+found");
        }

        const { brands } = await getProductFormData();

        res.render("admin/products/edit", {
            product,
            brands,
            errors: {},
            error: req.query.error || null,
            activePage: "products",
            admin: req.admin || res.locals.currentAdmin
        });
    } catch (error) {
        next(error);
    }
};

export const editProductHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await findProductById(id);
        if (!product || product.isDeleted) {
            return res.redirect("/admin/products?error=Product+not+found");
        }

        if (req.fileValidationError) {
            const { brands } = await getProductFormData();
            return res.status(400).render("admin/products/edit", {
                product: { ...product.toObject(), ...req.body },
                brands,
                errors: { images: req.fileValidationError },
                error: req.fileValidationError,
                activePage: "products",
                admin: req.admin || res.locals.currentAdmin
            });
        }

        const newImages = req.processedImages || [];
        let retainedImages = [];
        if (req.body.retainedImages) {
            retainedImages = Array.isArray(req.body.retainedImages)
                ? req.body.retainedImages
                : [req.body.retainedImages];
        }

        const totalImagesCount = retainedImages.length + newImages.length;
        const errors = validateProduct(req.body, totalImagesCount);

        if (Object.keys(errors).length > 0) {
            const { brands } = await getProductFormData();
            return res.status(400).render("admin/products/edit", {
                product: { ...product.toObject(), ...req.body, images: retainedImages },
                brands,
                errors,
                error: Object.values(errors).join(" "),
                activePage: "products",
                admin: req.admin || res.locals.currentAdmin
            });
        }

        await editProduct(id, req.body, newImages, retainedImages);

        res.redirect("/admin/products?updated=true");
    } catch (error) {
        const message = formatErrorMessage(error, "Failed to update product. Please verify your entries and try again.");
        const { brands } = await getProductFormData().catch(() => ({ brands: [] }));
        const product = await findProductById(req.params.id).catch(() => null);
        res.status(400).render("admin/products/edit", {
            product: product || req.body,
            brands,
            errors: { general: message },
            error: message,
            activePage: "products",
            admin: req.admin || res.locals.currentAdmin
        });
    }
};

export const deleteProductHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const search = req.query.search || "";
        const brand = req.query.brand || "";
        const status = req.query.status || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;

        await deleteProduct(id);

        res.redirect(`/admin/products?deleted=true&search=${encodeURIComponent(search)}&brand=${brand}&status=${status}&page=${page}&limit=${limit}`);
    } catch (error) {
        const search = req.query.search || "";
        const brand = req.query.brand || "";
        const status = req.query.status || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        const message = formatErrorMessage(error, "Failed to archive product.");
        res.redirect(`/admin/products?error=${encodeURIComponent(message)}&search=${encodeURIComponent(search)}&brand=${brand}&status=${status}&page=${page}&limit=${limit}`);
    }
};

export const restoreProductHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const search = req.query.search || "";
        const brand = req.query.brand || "";
        const status = req.query.status || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;

        await restoreProduct(id);

        res.redirect(`/admin/products?restored=true&search=${encodeURIComponent(search)}&brand=${brand}&status=${status}&page=${page}&limit=${limit}`);
    } catch (error) {
        const search = req.query.search || "";
        const brand = req.query.brand || "";
        const status = req.query.status || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        const message = formatErrorMessage(error, "Failed to restore product.");
        res.redirect(`/admin/products?error=${encodeURIComponent(message)}&search=${encodeURIComponent(search)}&brand=${brand}&status=${status}&page=${page}&limit=${limit}`);
    }
};

export const toggleProductStatusHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const search = req.query.search || "";
        const brand = req.query.brand || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;

        await toggleProduct(id);

        res.redirect(`/admin/products?toggled=true&search=${encodeURIComponent(search)}&brand=${brand}&page=${page}&limit=${limit}`);
    } catch (error) {
        const search = req.query.search || "";
        const brand = req.query.brand || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        const message = formatErrorMessage(error, "Failed to toggle product listing status.");
        res.redirect(`/admin/products?error=${encodeURIComponent(message)}&search=${encodeURIComponent(search)}&brand=${brand}&page=${page}&limit=${limit}`);
    }
};
