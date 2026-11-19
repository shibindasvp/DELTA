import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { formatErrorMessage } from "../utils/error.js";
import { uploadToCloudinary, isCloudinaryConfigured } from "../utils/cloudinary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const profileUploadDirectory = path.join(PROJECT_ROOT, "public", "uploads", "profile");
const productUploadDirectory = path.join(PROJECT_ROOT, "public", "uploads", "products");
const brandUploadDirectory = path.join(PROJECT_ROOT, "public", "uploads", "brands");
const categoryUploadDirectory = path.join(PROJECT_ROOT, "public", "uploads", "categories");
const bannerUploadDirectory = path.join(PROJECT_ROOT, "public", "uploads", "banners");

[
    profileUploadDirectory,
    productUploadDirectory,
    brandUploadDirectory,
    categoryUploadDirectory,
    bannerUploadDirectory
].forEach(dir => {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch {}
});

const memoryStorage = multer.memoryStorage();

const ALLOWED_IMAGE_MIMES = [
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/x-png",
    "image/webp"
];

const ALLOWED_IMAGE_EXTS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp"
];

export const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();

    if (ALLOWED_IMAGE_MIMES.includes(mime) && ALLOWED_IMAGE_EXTS.includes(ext)) {
        return cb(null, true);
    }
    return cb(new Error("Invalid image format. Only JPG, JPEG, PNG, and WebP images are allowed."));
};

// -------------------------------------------------------------
// 1. User Profile Picture Upload Middleware
// -------------------------------------------------------------
export const uploadProfileImage = multer({
    storage: memoryStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single("profileImage");

export const handleProfileUpload = (req, res, next) => {
    uploadProfileImage(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                req.fileValidationError = "Profile image file size exceeds the 5MB limit.";
            } else {
                req.fileValidationError = formatErrorMessage(err, "Failed to upload profile image. Please try again.");
            }
        }
        next();
    });
};

export const processAndResizeProfileImage = async (req, res, next) => {
    try {
        if (req.file && req.file.buffer) {
            const sharpBuffer = await sharp(req.file.buffer)
                .resize(500, 500, {
                    fit: "cover",
                    position: "center"
                })
                .webp({ quality: 90 })
                .toBuffer();

            const uploadResult = await uploadToCloudinary(sharpBuffer, {
                folder: "delta/profile"
            });

            req.file.cloudinaryUrl = uploadResult.url;
            req.file.cloudinaryPublicId = uploadResult.publicId;
            req.file.filename = path.basename(uploadResult.url);
            req.file.path = uploadResult.url;
        }
        next();
    } catch (error) {
        console.error("Profile image processing error:", error);
        req.fileValidationError = formatErrorMessage(
            error,
            "Unable to process profile image. Please upload a valid JPG, PNG, or WebP file."
        );
        next();
    }
};

// -------------------------------------------------------------
// 2. Product Images Upload Middleware (Multiple images, 3-6)
// -------------------------------------------------------------
export const uploadProductImages = multer({
    storage: memoryStorage,
    fileFilter,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit per photo
}).array("images", 6);

export const handleProductUpload = (req, res, next) => {
    if (!req.is("multipart/form-data")) {
        return next();
    }
    uploadProductImages(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                req.fileValidationError = "Timepiece photo size exceeds the 15MB limit.";
            } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
                req.fileValidationError = "A maximum of 6 timepiece images is allowed.";
            } else {
                req.fileValidationError = formatErrorMessage(err, "Failed to upload product images. Please try again.");
            }
        }
        next();
    });
};

export const processAndResizeProductImages = async (req, res, next) => {
    try {
        const processedImages = [];
        const cloudinaryImages = [];

        // Process files uploaded via Multer
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const sharpBuffer = await sharp(file.buffer)
                    .resize(1000, 1000, {
                        fit: "cover",
                        position: "center",
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    })
                    .webp({ quality: 90 })
                    .toBuffer();

                const uploadResult = await uploadToCloudinary(sharpBuffer, {
                    folder: "delta/products"
                });

                processedImages.push(uploadResult.url);
                cloudinaryImages.push({
                    url: uploadResult.url,
                    publicId: uploadResult.publicId
                });
            }
        }

        // Process cropped base64 images from client-side cropper
        if (req.body && req.body.croppedImages) {
            let croppedList = [];
            if (Array.isArray(req.body.croppedImages)) {
                croppedList = req.body.croppedImages;
            } else if (typeof req.body.croppedImages === "string") {
                try {
                    croppedList = JSON.parse(req.body.croppedImages);
                } catch {
                    croppedList = [req.body.croppedImages];
                }
            }

            for (const base64Str of croppedList) {
                if (typeof base64Str === "string" && base64Str.startsWith("data:image")) {
                    const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
                    if (matches && matches[2]) {
                        const buffer = Buffer.from(matches[2], "base64");
                        const sharpBuffer = await sharp(buffer)
                            .resize(1000, 1000, {
                                fit: "cover",
                                position: "center"
                            })
                            .webp({ quality: 90 })
                            .toBuffer();

                        const uploadResult = await uploadToCloudinary(sharpBuffer, {
                            folder: "delta/products"
                        });

                        processedImages.push(uploadResult.url);
                        cloudinaryImages.push({
                            url: uploadResult.url,
                            publicId: uploadResult.publicId
                        });
                    }
                }
            }
        }

        req.processedImages = processedImages;
        req.cloudinaryImages = cloudinaryImages;
        next();
    } catch (error) {
        console.error("Product image processing error:", error);
        req.fileValidationError = formatErrorMessage(
            error,
            "Unable to process timepiece photos. Please ensure all files are valid JPG, PNG, or WebP images."
        );
        next();
    }
};

// -------------------------------------------------------------
// 3. Brand Logo Upload Middleware
// -------------------------------------------------------------
export const uploadBrandLogo = multer({
    storage: memoryStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single("logo");

export const handleBrandLogoUpload = (req, res, next) => {
    if (!req.is("multipart/form-data")) {
        return next();
    }
    uploadBrandLogo(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                req.fileValidationError = "Brand logo file size exceeds the 5MB limit.";
            } else {
                req.fileValidationError = formatErrorMessage(err, "Failed to upload brand logo. Please try again.");
            }
        }
        next();
    });
};

export const processBrandLogo = async (req, res, next) => {
    try {
        if (req.file && req.file.buffer) {
            const sharpBuffer = await sharp(req.file.buffer)
                .resize(400, 400, {
                    fit: "contain",
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png({ quality: 90 })
                .toBuffer();

            const uploadResult = await uploadToCloudinary(sharpBuffer, {
                folder: "delta/brands"
            });

            req.file.cloudinaryUrl = uploadResult.url;
            req.file.cloudinaryPublicId = uploadResult.publicId;
            req.file.filename = path.basename(uploadResult.url);
            req.file.path = uploadResult.url;
        }
        next();
    } catch (error) {
        console.error("Brand logo processing error:", error);
        req.fileValidationError = formatErrorMessage(
            error,
            "Unable to process brand logo. Please upload a valid PNG, JPG, or WebP image."
        );
        next();
    }
};

// -------------------------------------------------------------
// 4. Category Image Upload Middleware
// -------------------------------------------------------------
export const uploadCategoryImage = multer({
    storage: memoryStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single("image");

export const handleCategoryUpload = (req, res, next) => {
    if (!req.is("multipart/form-data")) {
        return next();
    }
    uploadCategoryImage(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                req.fileValidationError = "Category image file size exceeds the 5MB limit.";
            } else {
                req.fileValidationError = formatErrorMessage(err, "Failed to upload category image. Please try again.");
            }
        }
        next();
    });
};

export const processCategoryImage = async (req, res, next) => {
    try {
        if (req.file && req.file.buffer) {
            const sharpBuffer = await sharp(req.file.buffer)
                .resize(800, 600, {
                    fit: "cover",
                    position: "center"
                })
                .webp({ quality: 90 })
                .toBuffer();

            const uploadResult = await uploadToCloudinary(sharpBuffer, {
                folder: "delta/categories"
            });

            req.file.cloudinaryUrl = uploadResult.url;
            req.file.cloudinaryPublicId = uploadResult.publicId;
            req.file.filename = path.basename(uploadResult.url);
            req.file.path = uploadResult.url;
        }
        next();
    } catch (error) {
        console.error("Category image processing error:", error);
        req.fileValidationError = formatErrorMessage(
            error,
            "Unable to process category image. Please upload a valid JPG, PNG, or WebP file."
        );
        next();
    }
};

// -------------------------------------------------------------
// 5. Website Banner Image Upload Middleware
// -------------------------------------------------------------
export const uploadBannerImage = multer({
    storage: memoryStorage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).single("image");

export const handleBannerUpload = (req, res, next) => {
    if (!req.is("multipart/form-data")) {
        return next();
    }
    uploadBannerImage(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                req.fileValidationError = "Banner image file size exceeds the 10MB limit.";
            } else {
                req.fileValidationError = formatErrorMessage(err, "Failed to upload banner image. Please try again.");
            }
        }
        next();
    });
};

export const processBannerImage = async (req, res, next) => {
    try {
        if (req.file && req.file.buffer) {
            const sharpBuffer = await sharp(req.file.buffer)
                .resize(1920, 800, {
                    fit: "cover",
                    position: "center"
                })
                .webp({ quality: 90 })
                .toBuffer();

            const uploadResult = await uploadToCloudinary(sharpBuffer, {
                folder: "delta/banners"
            });

            req.file.cloudinaryUrl = uploadResult.url;
            req.file.cloudinaryPublicId = uploadResult.publicId;
            req.file.filename = path.basename(uploadResult.url);
            req.file.path = uploadResult.url;
        }
        next();
    } catch (error) {
        console.error("Banner image processing error:", error);
        req.fileValidationError = formatErrorMessage(
            error,
            "Unable to process banner image. Please upload a valid JPG, PNG, or WebP file."
        );
        next();
    }
};
