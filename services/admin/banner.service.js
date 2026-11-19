import {
    createBanner,
    findBannerById,
    getBannersByPosition,
    getAllBanners,
    updateBannerById,
    softDeleteBannerById,
    hardDeleteBannerById
} from "../../repositories/banner.repository.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";

export const addBanner = async ({ title, subtitle, link, position = "hero", order = 0, imageFile, imageBase64, isActive = true }) => {
    const trimmedTitle = (title || "").trim();
    if (!trimmedTitle) {
        throw new Error("Banner title is required.");
    }

    if (!imageFile && !imageBase64) {
        throw new Error("Banner image is required.");
    }

    const fileInput = imageFile?.buffer || imageBase64;
    const uploadResult = await uploadToCloudinary(fileInput, { folder: "delta/banners" });

    return await createBanner({
        title: trimmedTitle,
        subtitle: (subtitle || "").trim(),
        link: (link || "").trim(),
        position,
        order: parseInt(order, 10) || 0,
        image: uploadResult.url,
        imagePublicId: uploadResult.publicId,
        isActive: Boolean(isActive),
        isDeleted: false
    });
};

export const editBanner = async (id, { title, subtitle, link, position, order, imageFile, imageBase64, isActive }) => {
    const banner = await findBannerById(id);
    if (!banner || banner.isDeleted) {
        throw new Error("Banner not found.");
    }

    const updatePayload = {};

    if (title) updatePayload.title = title.trim();
    if (subtitle !== undefined) updatePayload.subtitle = subtitle.trim();
    if (link !== undefined) updatePayload.link = link.trim();
    if (position !== undefined) updatePayload.position = position;
    if (order !== undefined) updatePayload.order = parseInt(order, 10) || 0;
    if (isActive !== undefined) updatePayload.isActive = Boolean(isActive);

    // Handle Image Replacement
    if (imageFile || imageBase64) {
        // Delete old banner image from Cloudinary
        if (banner.imagePublicId || banner.image) {
            await deleteFromCloudinary(banner.imagePublicId || banner.image);
        }

        const fileInput = imageFile?.buffer || imageBase64;
        const uploadResult = await uploadToCloudinary(fileInput, { folder: "delta/banners" });
        updatePayload.image = uploadResult.url;
        updatePayload.imagePublicId = uploadResult.publicId;
    }

    return await updateBannerById(id, updatePayload);
};

export const deleteBanner = async (id, { permanent = false } = {}) => {
    const banner = await findBannerById(id);
    if (!banner) {
        throw new Error("Banner not found.");
    }

    if (permanent) {
        if (banner.imagePublicId || banner.image) {
            await deleteFromCloudinary(banner.imagePublicId || banner.image);
        }
        return await hardDeleteBannerById(id);
    }

    return await softDeleteBannerById(id);
};

export const getActiveBanners = async (position = "hero") => {
    return await getBannersByPosition(position);
};
