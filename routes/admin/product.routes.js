import express from "express";
import {
    isAdminAuthenticated,
    preventAdminCache
} from "../../middlewares/adminAuth.middleware.js";
import {
    handleProductUpload,
    processAndResizeProductImages
} from "../../middlewares/upload.middleware.js";
import {
    showProducts,
    showAddProduct,
    addProductHandler,
    showEditProduct,
    editProductHandler,
    deleteProductHandler,
    restoreProductHandler,
    toggleProductStatusHandler
} from "../../controllers/admin/product.controller.js";

const router = express.Router();


router.get(
    "/products",
    isAdminAuthenticated,
    preventAdminCache,
    showProducts
);


router.get(
    "/products/add",
    isAdminAuthenticated,
    preventAdminCache,
    showAddProduct
);


router.post(
    "/products/add",
    isAdminAuthenticated,
    handleProductUpload,
    processAndResizeProductImages,
    addProductHandler
);


router.get(
    ["/products/:id/edit", "/products/edit/:id"],
    isAdminAuthenticated,
    preventAdminCache,
    showEditProduct
);


router.post(
    ["/products/:id/edit", "/products/edit/:id"],
    isAdminAuthenticated,
    handleProductUpload,
    processAndResizeProductImages,
    editProductHandler
);


router.post(
    "/products/:id/delete",
    isAdminAuthenticated,
    deleteProductHandler
);


router.post(
    "/products/:id/restore",
    isAdminAuthenticated,
    restoreProductHandler
);


router.post(
    "/products/:id/toggle-status",
    isAdminAuthenticated,
    toggleProductStatusHandler
);

export default router;
