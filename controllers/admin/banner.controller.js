import {
    addBanner,
    editBanner,
    deleteBanner,
    getActiveBanners
} from "../../services/admin/banner.service.js";
import { getAllBanners } from "../../repositories/banner.repository.js";

export const getBannersHandler = async (req, res, next) => {
    try {
        const banners = await getAllBanners();
        res.json({ success: true, banners });
    } catch (error) {
        next(error);
    }
};

export const addBannerHandler = async (req, res, next) => {
    try {
        if (req.fileValidationError) {
            return res.status(400).json({ success: false, message: req.fileValidationError });
        }

        const banner = await addBanner({
            title: req.body.title,
            subtitle: req.body.subtitle,
            link: req.body.link,
            position: req.body.position || "hero",
            order: req.body.order || 0,
            imageFile: req.file,
            imageBase64: req.body.image,
            isActive: req.body.isActive === undefined ? true : (req.body.isActive === "true" || req.body.isActive === true)
        });

        res.status(201).json({
            success: true,
            message: "Banner created successfully with Cloudinary asset.",
            banner
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || "Failed to create banner."
        });
    }
};

export const editBannerHandler = async (req, res, next) => {
    try {
        if (req.fileValidationError) {
            return res.status(400).json({ success: false, message: req.fileValidationError });
        }

        const { id } = req.params;
        const banner = await editBanner(id, {
            title: req.body.title,
            subtitle: req.body.subtitle,
            link: req.body.link,
            position: req.body.position,
            order: req.body.order,
            imageFile: req.file,
            imageBase64: req.body.image,
            isActive: req.body.isActive !== undefined ? (req.body.isActive === "true" || req.body.isActive === true) : undefined
        });

        res.json({
            success: true,
            message: "Banner updated successfully.",
            banner
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || "Failed to update banner."
        });
    }
};

export const deleteBannerHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const permanent = req.query.permanent === "true" || req.body.permanent === true;
        await deleteBanner(id, { permanent });

        res.json({
            success: true,
            message: permanent ? "Banner permanently removed and Cloudinary asset cleaned up." : "Banner archived successfully."
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || "Failed to delete banner."
        });
    }
};
