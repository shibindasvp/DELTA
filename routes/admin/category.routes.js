import express from "express";
import {
    isAdminAuthenticated,
    preventAdminCache
} from "../../middlewares/adminAuth.middleware.js";
import {
    handleCategoryUpload,
    processCategoryImage
} from "../../middlewares/upload.middleware.js";
import {
    getCategoriesHandler,
    addCategoryHandler,
    editCategoryHandler,
    deleteCategoryHandler
} from "../../controllers/admin/category.controller.js";

const router = express.Router();

router.get(
    "/categories",
    isAdminAuthenticated,
    preventAdminCache,
    getCategoriesHandler
);

router.post(
    "/categories/add",
    isAdminAuthenticated,
    handleCategoryUpload,
    processCategoryImage,
    addCategoryHandler
);

router.post(
    "/categories/:id/edit",
    isAdminAuthenticated,
    handleCategoryUpload,
    processCategoryImage,
    editCategoryHandler
);

router.post(
    "/categories/:id/delete",
    isAdminAuthenticated,
    deleteCategoryHandler
);

export default router;
