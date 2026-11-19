import Category from "../models/category.model.js";

export const createCategory = async (data) => {
    return await Category.create(data);
};

export const findCategoryById = async (id) => {
    return await Category.findById(id);
};

export const findCategoryByName = async (name) => {
    return await Category.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        isDeleted: false
    });
};

export const getAllActiveCategories = async () => {
    return await Category.find({ isActive: true, isDeleted: false }).sort({ name: 1 }).lean();
};

export const getAllCategories = async () => {
    return await Category.find().sort({ createdAt: -1 }).lean();
};

export const updateCategoryById = async (id, updateData) => {
    return await Category.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

export const softDeleteCategoryById = async (id) => {
    return await Category.findByIdAndUpdate(id, { isDeleted: true, isActive: false }, { new: true });
};

export const hardDeleteCategoryById = async (id) => {
    return await Category.findByIdAndDelete(id);
};
