import mongoose from "mongoose";
import { EMAIL_REGEX } from "../utils/constants.js";

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Admin name is required"],
            trim: true
        },

        email: {
            type: String,
            required: [true, "Admin email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [EMAIL_REGEX, "Please provide a valid email address"]
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            select: false
        },

        role: {
            type: String,
            default: "admin"
        },

        permissions: {
            type: [String],
            default: ["all"]
        },

        isBlocked: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
