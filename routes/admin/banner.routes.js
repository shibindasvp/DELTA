import express from "express";
import {
    isAdminAuthenticated,
    preventAdminCache
} from "../../middlewares/adminAuth.middleware.js";
import {
    handleBannerUpload,
    processBannerImage
} from "../../middlewares/upload.middleware.js";
import {
    getBannersHandler,
    addBannerHandler,
    editBannerHandler,
    deleteBannerHandler
} from "../../controllers/admin/banner.controller.js";

const router = express.Router();

router.get(
    "/banners",
    isAdminAuthenticated,
    preventAdminCache,
    getBannersHandler
);

router.post(
    "/banners/add",
    isAdminAuthenticated,
    handleBannerUpload,
    processBannerImage,
    addBannerHandler
);

router.post(
    "/banners/:id/edit",
    isAdminAuthenticated,
    handleBannerUpload,
    processBannerImage,
    editBannerHandler
);

router.post(
    "/banners/:id/delete",
    isAdminAuthenticated,
    deleteBannerHandler
);

export default router;
