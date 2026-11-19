import dotenv from "dotenv";
dotenv.config();

export const config = {
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT || 3000,
    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/delta_ecommerce",
    jwtSecret: process.env.JWT_SECRET || "delta_super_secret_jwt_key_2026",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
    email: {
        user: process.env.EMAIL_USER || process.env.MAIL_USER,
        pass: process.env.EMAIL_PASSWORD || process.env.MAIL_PASS,
        host: process.env.MAIL_HOST || "smtp.gmail.com",
        port: process.env.MAIL_PORT || 587,
        from: process.env.MAIL_FROM || "DELTA <noreply@delta.com>"
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
        url: process.env.CLOUDINARY_URL
    }
};

export default config;
