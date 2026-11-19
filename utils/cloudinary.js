import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";
export { isCloudinaryConfigured };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Extracts Cloudinary public ID from a full Cloudinary URL.
 * e.g. https://res.cloudinary.com/.../image/upload/v1234/delta/products/watch-1.webp -> "delta/products/watch-1"
 */
export const extractPublicIdFromUrl = (url) => {
    if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) {
        return null;
    }
    const partsAfterUpload = url.split("/upload/")[1];
    if (!partsAfterUpload) return null;

    const segments = partsAfterUpload.split("/");
    const cleanSegments = [];
    let passedVersionOrTransform = false;

    for (const seg of segments) {
        if (!passedVersionOrTransform) {
            // Check if segment is version (e.g. v1700000000)
            if (/^v\d+$/.test(seg)) {
                passedVersionOrTransform = true;
                continue;
            }
            // Check if segment is transformation parameters (e.g. c_fill,w_300,h_300)
            if (seg.includes(",") || /^[a-z]_[a-z0-9_]+$/i.test(seg)) {
                continue;
            }
            passedVersionOrTransform = true;
        }
        cleanSegments.push(seg);
    }

    const fullPath = cleanSegments.join("/");
    // Remove query string and file extension
    return fullPath.split("?")[0].replace(/\.[^/.]+$/, "");
};

/**
 * Uploads a single file buffer, base64 data URI, or local file path to Cloudinary.
 * If Cloudinary is not configured, falls back gracefully to local disk storage.
 *
 * @param {Buffer|string} fileInput - Buffer, base64 string ("data:image/..."), or file path
 * @param {Object} options - Upload options
 * @param {string} options.folder - Destination folder in Cloudinary (e.g. "delta/products")
 * @param {string} [options.publicId] - Custom public ID
 * @param {Array|Object} [options.transformation] - Cloudinary transformations
 * @param {Array} [options.tags] - Array of tag strings
 * @returns {Promise<{ url: string, secure_url: string, publicId: string, public_id: string, format: string, bytes: number }>}
 */
export const uploadToCloudinary = async (fileInput, options = {}) => {
    const folder = options.folder || "delta";
    const tags = options.tags || ["delta-ecommerce"];
    const transformation = options.transformation || [
        { quality: "auto:good" },
        { fetch_format: "auto" }
    ];

    // Fallback if Cloudinary is not configured: save to local disk
    if (!isCloudinaryConfigured()) {
        const subFolder = folder.replace(/^delta\/?/, "") || "misc";
        const localUploadDir = path.join(PROJECT_ROOT, "public", "uploads", subFolder);
        if (!fs.existsSync(localUploadDir)) {
            fs.mkdirSync(localUploadDir, { recursive: true });
        }

        let buffer;
        let ext = "webp";

        if (Buffer.isBuffer(fileInput)) {
            buffer = fileInput;
        } else if (typeof fileInput === "string" && fileInput.startsWith("data:image")) {
            const matches = fileInput.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
            if (matches && matches[2]) {
                ext = matches[1].toLowerCase().replace("jpeg", "jpg");
                buffer = Buffer.from(matches[2], "base64");
            }
        } else if (typeof fileInput === "string" && fs.existsSync(fileInput)) {
            buffer = fs.readFileSync(fileInput);
            ext = path.extname(fileInput).replace(".", "") || "jpg";
        }

        if (!buffer) {
            throw new Error("Invalid file input provided for image upload.");
        }

        const filename = `${options.publicId ? path.basename(options.publicId) : "file"}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
        const outputPath = path.join(localUploadDir, filename);
        fs.writeFileSync(outputPath, buffer);

        const localUrl = `/uploads/${subFolder}/${filename}`;
        return {
            url: localUrl,
            secure_url: localUrl,
            publicId: `${folder}/${filename.replace(/\.[^/.]+$/, "")}`,
            public_id: `${folder}/${filename.replace(/\.[^/.]+$/, "")}`,
            format: ext,
            bytes: buffer.length
        };
    }

    // Cloudinary upload implementation
    const uploadOptions = {
        folder,
        tags,
        resource_type: "image",
        transformation
    };

    if (options.publicId) {
        uploadOptions.public_id = options.publicId;
    }

    // Case 1: Buffer upload via upload_stream
    if (Buffer.isBuffer(fileInput)) {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                if (error) return reject(error);
                resolve({
                    url: result.secure_url,
                    secure_url: result.secure_url,
                    publicId: result.public_id,
                    public_id: result.public_id,
                    format: result.format,
                    bytes: result.bytes,
                    width: result.width,
                    height: result.height
                });
            });
            stream.end(fileInput);
        });
    }

    // Case 2: Base64 data URI or string path
    if (typeof fileInput === "string") {
        const result = await cloudinary.uploader.upload(fileInput, uploadOptions);
        return {
            url: result.secure_url,
            secure_url: result.secure_url,
            publicId: result.public_id,
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height
        };
    }

    throw new Error("Unsupported file input format. Expected a Buffer, base64 data URI, or valid file path.");
};

/**
 * Uploads multiple files to Cloudinary concurrently.
 * If ANY upload fails, it automatically rolls back and deletes all already-uploaded
 * files in this transaction to prevent orphaned assets.
 *
 * @param {Array<Buffer|string>} files - Array of Buffers, base64 strings, or file paths
 * @param {Object} options - Upload options
 * @returns {Promise<Array<{ url: string, publicId: string }>>}
 */
export const uploadMultipleToCloudinary = async (files = [], options = {}) => {
    if (!Array.isArray(files) || files.length === 0) {
        return [];
    }

    const uploadedResults = [];

    try {
        for (const file of files) {
            const result = await uploadToCloudinary(file, options);
            uploadedResults.push(result);
        }
        return uploadedResults;
    } catch (uploadError) {
        // Rollback all successfully uploaded images in this batch on error
        console.error("Batch Cloudinary upload encountered an error. Rolling back already uploaded assets:", uploadError.message);
        const publicIdsToClean = uploadedResults.map(r => r.publicId).filter(Boolean);
        if (publicIdsToClean.length > 0) {
            await deleteMultipleFromCloudinary(publicIdsToClean).catch(cleanErr => {
                console.error("Cleanup error during rollback:", cleanErr.message);
            });
        }
        throw uploadError;
    }
};

/**
 * Deletes a single image from Cloudinary by its public ID or full URL.
 * Safely handles null/undefined inputs and local paths.
 *
 * @param {string} publicIdOrUrl
 * @returns {Promise<boolean>}
 */
export const deleteFromCloudinary = async (publicIdOrUrl) => {
    if (!publicIdOrUrl || typeof publicIdOrUrl !== "string") {
        return false;
    }

    // If a full Cloudinary URL was provided, extract the public ID
    let publicId = publicIdOrUrl;
    if (publicIdOrUrl.includes("cloudinary.com")) {
        publicId = extractPublicIdFromUrl(publicIdOrUrl);
    }

    // If it's a local upload path, delete from disk
    if (publicIdOrUrl.startsWith("/uploads/") || publicIdOrUrl.startsWith("uploads/")) {
        try {
            const relativePath = publicIdOrUrl.startsWith("/") ? publicIdOrUrl.slice(1) : publicIdOrUrl;
            const fullLocalPath = path.join(PROJECT_ROOT, "public", relativePath);
            if (fs.existsSync(fullLocalPath)) {
                fs.unlinkSync(fullLocalPath);
            }
            return true;
        } catch {
            return false;
        }
    }

    if (!publicId || !isCloudinaryConfigured()) {
        return false;
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result.result === "ok" || result.result === "not found";
    } catch (destroyError) {
        console.error(`Error deleting Cloudinary asset "${publicId}":`, destroyError.message);
        return false;
    }
};

/**
 * Deletes multiple images from Cloudinary.
 *
 * @param {Array<string>} publicIdsOrUrls
 * @returns {Promise<number>} Number of successfully processed deletions
 */
export const deleteMultipleFromCloudinary = async (publicIdsOrUrls = []) => {
    if (!Array.isArray(publicIdsOrUrls) || publicIdsOrUrls.length === 0) {
        return 0;
    }

    const deletionPromises = publicIdsOrUrls.map(id => deleteFromCloudinary(id));
    const results = await Promise.allSettled(deletionPromises);
    return results.filter(r => r.status === "fulfilled" && r.value).length;
};
