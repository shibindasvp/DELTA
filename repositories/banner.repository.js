import Banner from "../models/banner.model.js";

export const createBanner = async (data) => {
    return await Banner.create(data);
};

export const findBannerById = async (id) => {
    return await Banner.findById(id);
};

export const getBannersByPosition = async (position = "hero") => {
    return await Banner.find({ position, isActive: true, isDeleted: false }).sort({ order: 1, createdAt: -1 }).lean();
};

export const getAllBanners = async () => {
    return await Banner.find({ isDeleted: false }).sort({ position: 1, order: 1 }).lean();
};

export const updateBannerById = async (id, updateData) => {
    return await Banner.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

export const softDeleteBannerById = async (id) => {
    return await Banner.findByIdAndUpdate(id, { isDeleted: true, isActive: false }, { new: true });
};

export const hardDeleteBannerById = async (id) => {
    return await Banner.findByIdAndDelete(id);
};
