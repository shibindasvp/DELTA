import mongoose from "mongoose";

import {
    NAME_REGEX,
    EMAIL_REGEX,
    PHONE_REGEX
} from "../utils/constants.js";

const userSchema =
    new mongoose.Schema(
        {
            name: {
                type: String,
                required: [
                    true,
                    "Full name is required"
                ],
                trim: true,
                minlength: 3,
                maxlength: 50,
                match: [
                    NAME_REGEX,
                    "Please enter a valid name"
                ]
            },

            email: {
                type: String,
                required: [
                    true,
                    "Email is required"
                ],
                unique: true,
                lowercase: true,
                trim: true,
                match: [
                    EMAIL_REGEX,
                    "Please provide a valid email address"
                ],
                index: true
            },

            password: {
                type: String,
                select: false,
                default: null
            },

            phone: {
                type: String,
                trim: true,
                default: null,
                validate: {
                    validator: function (value) {
                        return (
                            !value ||
                            PHONE_REGEX.test(
                                value
                            )
                        );
                    },
                    message:
                        "Please provide a valid phone number"
                }
            },

            profileImage: {
                type: String,
                default: null
            },

            profileImagePublicId: {
                type: String,
                default: null
            },

            role: {
                type: String,
                enum: ["user", "admin"],
                default: "user",
                index: true
            },

            authProvider: {
                type: String,
                enum: ["local", "google"],
                default: "local"
            },

            providerId: {
                type: String,
                default: null,
                sparse: true
            },

            isVerified: {
                type: Boolean,
                default: false
            },

            isBlocked: {
                type: Boolean,
                default: false,
                index: true
            },

            referralCode: {
                type: String,
                default: null,
                trim: true
            },

            referredBy: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null
            },

            walletBalance: {
                type: Number,
                default: 0
            },

            wallet: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Wallet",
                default: null
            }
        },
        {
            timestamps: true
        }
    );

userSchema.virtual(
    "fullName"
).get(function () {
    return this.name;
});

userSchema.set(
    "toJSON",
    {
        virtuals: true,
        transform: function (
            doc,
            ret
        ) {
            delete ret.password;
            delete ret.providerId;
            return ret;
        }
    }
);

const User =
    mongoose.model(
        "User",
        userSchema
    );

export default User;