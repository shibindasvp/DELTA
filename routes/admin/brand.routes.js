import express from "express";
import {
    isAdminAuthenticated,
    preventAdminCache
} from "../../middlewares/adminAuth.middleware.js";
import {
    handleBrandLogoUpload,
    processBrandLogo
} from "../../middlewares/upload.middleware.js";
import {
    showBrands,
    addBrandHandler,
    editBrandHandler,
    deleteBrandHandler,
    permanentDeleteBrandHandler,
    permanentDeleteAllArchivedBrandsHandler,
    restoreBrandHandler,
    toggleBrandStatusHandler
} from "../../controllers/admin/brand.controller.js";

const router = express.Router();


router.get(
    "/brands",
    isAdminAuthenticated,
    preventAdminCache,
    showBrands
);


router.post(
    "/brands/add",
    isAdminAuthenticated,
    handleBrandLogoUpload,
    processBrandLogo,
    addBrandHandler
);


router.post(
    "/brands/:id/edit",
    isAdminAuthenticated,
    handleBrandLogoUpload,
    processBrandLogo,
    editBrandHandler
);


router.post(
    "/brands/:id/delete",
    isAdminAuthenticated,
    deleteBrandHandler
);


router.post(
    "/brands/permanent-delete-all",
    isAdminAuthenticated,
    permanentDeleteAllArchivedBrandsHandler
);

router.post(
    "/brands/:id/permanent-delete",
    isAdminAuthenticated,
    permanentDeleteBrandHandler
);


router.post(
    "/brands/:id/restore",
    isAdminAuthenticated,
    restoreBrandHandler
);


router.post(
    "/brands/:id/toggle-status",
    isAdminAuthenticated,
    toggleBrandStatusHandler
);

export default router;
