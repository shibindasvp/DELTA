import {
    createCategory,
    findCategoryById,
    findCategoryByName,
    updateCategoryById,
    softDeleteCategoryById,
    hardDeleteCategoryById,
    getAllActiveCategories
} from "../../repositories/category.repository.js";
import { slugify } from "../../utils/slugify.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";

export const addCategory = async ({ name, description, imageFile, imageBase64, isActive = true }) => {
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
        throw new Error("Category name is required.");
    }

    const existing = await findCategoryByName(trimmedName);
    if (existing) {
        throw new Error(`A category named "${trimmedName}" already exists.`);
    }

    let slug = slugify(trimmedName);
    let imageUrl = "";
    let imagePublicId = "";

    if (imageFile || imageBase64) {
        const fileInput = imageFile?.buffer || imageBase64;
        const uploadResult = await uploadToCloudinary(fileInput, { folder: "delta/categories" });
        imageUrl = uploadResult.url;
        imagePublicId = uploadResult.publicId;
    }

    return await createCategory({
        name: trimmedName,
        slug,
        description: (description || "").trim(),
        image: imageUrl,
        imagePublicId,
        isActive: Boolean(isActive),
        isDeleted: false
    });
};

export const editCategory = async (id, { name, description, imageFile, imageBase64, isActive }) => {
    const category = await findCategoryById(id);
    if (!category || category.isDeleted) {
        throw new Error("Category not found.");
    }

    const updatePayload = {};

    if (name) {
        const trimmedName = name.trim();
        updatePayload.name = trimmedName;
        updatePayload.slug = slugify(trimmedName);
    }

    if (description !== undefined) {
        updatePayload.description = description.trim();
    }

    if (isActive !== undefined) {
        updatePayload.isActive = Boolean(isActive);
    }

    // Handle Image Replacement
    if (imageFile || imageBase64) {
        // Delete old image from Cloudinary
        if (category.imagePublicId || category.image) {
            await deleteFromCloudinary(category.imagePublicId || category.image);
        }

        const fileInput = imageFile?.buffer || imageBase64;
        const uploadResult = await uploadToCloudinary(fileInput, { folder: "delta/categories" });
        updatePayload.image = uploadResult.url;
        updatePayload.imagePublicId = uploadResult.publicId;
    }

    return await updateCategoryById(id, updatePayload);
};

export const deleteCategory = async (id, { permanent = false } = {}) => {
    const category = await findCategoryById(id);
    if (!category) {
        throw new Error("Category not found.");
    }

    if (permanent) {
        if (category.imagePublicId || category.image) {
            await deleteFromCloudinary(category.imagePublicId || category.image);
        }
        return await hardDeleteCategoryById(id);
    }

    return await softDeleteCategoryById(id);
};

export const getActiveCategories = async () => {
    return await getAllActiveCategories();
};
