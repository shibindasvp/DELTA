import { v2 as cloudinary } from "cloudinary";
import config from "./env.js";

const cloudName = config.cloudinary?.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = config.cloudinary?.apiKey || process.env.CLOUDINARY_API_KEY;
const apiSecret = config.cloudinary?.apiSecret || process.env.CLOUDINARY_API_SECRET;
const cloudinaryUrl = config.cloudinary?.url || process.env.CLOUDINARY_URL;

if (cloudinaryUrl) {
    cloudinary.config();
} else if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });
}

export const isCloudinaryConfigured = () => {
    return Boolean(
        process.env.CLOUDINARY_URL ||
        (cloudName && apiKey && apiSecret)
    );
};

export default cloudinary;
