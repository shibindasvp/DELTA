import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { formatErrorMessage } from "../utils/error.js";

const profileUploadDirectory = path.join(process.cwd(), "public", "uploads", "profile");
const productUploadDirectory = path.join(process.cwd(), "public", "uploads", "products");

if (!fs.existsSync(profileUploadDirectory)) {
    fs.mkdirSync(profileUploadDirectory, { recursive: true });
}
if (!fs.existsSync(productUploadDirectory)) {
    fs.mkdirSync(productUploadDirectory, { recursive: true });
}

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
            const ext = path.extname(req.file.originalname || "").toLowerCase();
            const mime = (req.file.mimetype || "").toLowerCase();

            const isWebp = mime.includes("webp") || ext === ".webp";
            const isPng = mime.includes("png") || ext === ".png";
            const outExt = isWebp ? "webp" : (isPng ? "png" : "jpg");

            const filename = `profile-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${outExt}`;
            const outputPath = path.join(profileUploadDirectory, filename);

            const sharpPipeline = sharp(req.file.buffer)
                .resize(500, 500, {
                    fit: "cover",
                    position: "center"
                });

            if (isWebp) {
                await sharpPipeline.webp({ quality: 90 }).toFile(outputPath);
            } else if (isPng) {
                await sharpPipeline.png({ quality: 90, compressionLevel: 8 }).toFile(outputPath);
            } else {
                await sharpPipeline.jpeg({ quality: 90, mozjpeg: true }).toFile(outputPath);
            }

            req.file.filename = filename;
            req.file.path = outputPath;
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

export const uploadProductImages = multer({
    storage: memoryStorage,
    fileFilter,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit per photo
}).array("images", 10);

export const handleProductUpload = (req, res, next) => {
    uploadProductImages(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                req.fileValidationError = "Timepiece photo size exceeds the 15MB limit.";
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

 
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const ext = path.extname(file.originalname || "").toLowerCase();
                const mime = (file.mimetype || "").toLowerCase();

                const isWebp = mime.includes("webp") || ext === ".webp";
                const isPng = mime.includes("png") || ext === ".png";
                const outExt = isWebp ? "webp" : (isPng ? "png" : "jpg");

                const filename = `product-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${outExt}`;
                const outputPath = path.join(productUploadDirectory, filename);

                const sharpPipeline = sharp(file.buffer)
                    .resize(1000, 1000, {
                        fit: "cover",
                        position: "center",
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    });

                if (isWebp) {
                    await sharpPipeline.webp({ quality: 90 }).toFile(outputPath);
                } else if (isPng) {
                    await sharpPipeline.png({ quality: 90, compressionLevel: 8 }).toFile(outputPath);
                } else {
                    await sharpPipeline.jpeg({ quality: 90, mozjpeg: true }).toFile(outputPath);
                }

                processedImages.push(`/uploads/products/${filename}`);
            }
        }

  
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
                        const mimeType = matches[1].toLowerCase();
                        const isWebp = mimeType.includes("webp");
                        const isPng = mimeType.includes("png");
                        const outExt = isWebp ? "webp" : (isPng ? "png" : "jpg");

                        const buffer = Buffer.from(matches[2], "base64");
                        const filename = `product-crop-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${outExt}`;
                        const outputPath = path.join(productUploadDirectory, filename);

                        const sharpPipeline = sharp(buffer)
                            .resize(1000, 1000, {
                                fit: "cover",
                                position: "center"
                            });

                        if (isWebp) {
                            await sharpPipeline.webp({ quality: 90 }).toFile(outputPath);
                        } else if (isPng) {
                            await sharpPipeline.png({ quality: 90, compressionLevel: 8 }).toFile(outputPath);
                        } else {
                            await sharpPipeline.jpeg({ quality: 90, mozjpeg: true }).toFile(outputPath);
                        }

                        processedImages.push(`/uploads/products/${filename}`);
                    }
                }
            }
        }

        req.processedImages = processedImages;
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
