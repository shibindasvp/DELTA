import {
    addCategory,
    editCategory,
    deleteCategory,
    getActiveCategories
} from "../../services/admin/category.service.js";
import { getAllCategories } from "../../repositories/category.repository.js";

export const getCategoriesHandler = async (req, res, next) => {
    try {
        const categories = await getAllCategories();
        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({ success: true, categories });
        }
        res.json({ success: true, categories });
    } catch (error) {
        next(error);
    }
};

export const addCategoryHandler = async (req, res, next) => {
    try {
        if (req.fileValidationError) {
            return res.status(400).json({ success: false, message: req.fileValidationError });
        }

        const category = await addCategory({
            name: req.body.name,
            description: req.body.description,
            imageFile: req.file,
            imageBase64: req.body.image,
            isActive: req.body.isActive === undefined ? true : (req.body.isActive === "true" || req.body.isActive === true)
        });

        res.status(201).json({
            success: true,
            message: "Category created successfully with Cloudinary asset.",
            category
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || "Failed to create category."
        });
    }
};

export const editCategoryHandler = async (req, res, next) => {
    try {
        if (req.fileValidationError) {
            return res.status(400).json({ success: false, message: req.fileValidationError });
        }

        const { id } = req.params;
        const category = await editCategory(id, {
            name: req.body.name,
            description: req.body.description,
            imageFile: req.file,
            imageBase64: req.body.image,
            isActive: req.body.isActive !== undefined ? (req.body.isActive === "true" || req.body.isActive === true) : undefined
        });

        res.json({
            success: true,
            message: "Category updated successfully.",
            category
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || "Failed to update category."
        });
    }
};

export const deleteCategoryHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const permanent = req.query.permanent === "true" || req.body.permanent === true;
        await deleteCategory(id, { permanent });

        res.json({
            success: true,
            message: permanent ? "Category permanently removed and Cloudinary asset cleaned up." : "Category archived successfully."
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || "Failed to delete category."
        });
    }
};
