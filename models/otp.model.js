import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },

        otp: {
            type: String,
            required: true,
            select: false
        },

        purpose: {
            type: String,
            enum: [
                "signup",
                "forgot-password",
                "change-email",
                "admin-forgot-password",
                "google-signin"
            ],
            required: true
        },

        payload: {
            type: Object,
            default: {}
        },

        expiresAt: {
            type: Date,
            required: true
        },

        attempts: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

otpSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

otpSchema.index(
    {
        email: 1,
        purpose: 1
    }
);

const OTP =
    mongoose.model("OTP", otpSchema);

export default OTP;