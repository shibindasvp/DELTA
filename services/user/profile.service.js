import crypto from "crypto";
import User from "../../models/user.model.js";

import {
    findUserById,
    updateUserById,
    findUserWithPassword,
    updateUserPassword,
    findUserByEmail
} from "../../repositories/user.repository.js";

import {
    findAddressesByUser
} from "../../repositories/address.repository.js";

import {
    comparePassword,
    hashPassword
} from "../../utils/hashPassword.js";

import {
    createAndSendOTP,
    verifyOTP
} from "./otp.service.js";

import {
    normalizeEmail
} from "../../validations/auth.validation.js";

export const getProfile = async (userId) => {
    let user = await findUserById(userId);

    if (!user) {
        throw new Error("User not found.");
    }


    if (!user.referralCode) {
        const generatedCode = "DLT-" + crypto.randomBytes(3).toString("hex").toUpperCase();
        user = await updateUserById(userId, { referralCode: generatedCode });
    }

    const addresses = await findAddressesByUser(userId);

    const defaultAddress =
        addresses.find(address => address.isDefault) ||
        addresses[0] ||
        null;

    const referredCount = await User.countDocuments({ referredBy: user._id });

    return {
        user,
        addresses,
        defaultAddress,
        referredCount
    };
};

export const updateProfile = async (userId, data) => {
    const updateData = {
        name: (data.name || data.fullName || "").trim()
    };

    if (data.phone !== undefined) {
        updateData.phone = data.phone?.trim() || null;
    }

    if (data.profileImage) {
        updateData.profileImage = data.profileImage;
    }

    return await updateUserById(userId, updateData);
};

export const changePassword = async ({
    userId,
    currentPassword,
    newPassword
}) => {
    const existingUser = await findUserById(userId);

    if (!existingUser) {
        throw new Error("User not found.");
    }

    const user = await findUserWithPassword(existingUser.email);

    if (!user) {
        throw new Error("User not found.");
    }


    const isGoogleUser = Boolean(user.authProvider === "google" || user.providerId || user.googleId);
    if (isGoogleUser && !user.password) {
        throw new Error("Google-linked accounts cannot change password directly initially. Please use Reset Password first to establish an account password.");
    }

    if (!user.password) {
        throw new Error("Account does not have an existing password configured. Please use Reset Password first.");
    }

    if (!currentPassword) {
        throw new Error("Current password is required.");
    }

    const isMatch = await comparePassword(
        currentPassword,
        user.password
    );

    if (!isMatch) {
        throw new Error("Current password is incorrect.");
    }

    const hashedPassword = await hashPassword(newPassword);

    await updateUserPassword(userId, hashedPassword);

    return true;
};

export const startEmailChange = async ({
    userId,
    newEmail
}) => {
    const user = await findUserById(userId);
    if (!user) {
        throw new Error("User not found.");
    }

    if (user.authProvider === "google" || user.providerId) {
        throw new Error("Google-linked accounts cannot change their registered email address.");
    }

    const normalizedEmail = normalizeEmail(newEmail);

    const existing = await findUserByEmail(normalizedEmail);

    if (
        existing &&
        existing._id.toString() !== userId.toString()
    ) {
        throw new Error(
            "This email is already registered to another account."
        );
    }

    await createAndSendOTP({
        email: normalizedEmail,
        purpose: "change-email",
        payload: {
            userId: userId.toString(),
            newEmail: normalizedEmail
        }
    });

    return {
        email: normalizedEmail
    };
};

export const verifyEmailChange = async ({
    email,
    otp,
    userId
}) => {
    const normalizedEmail = normalizeEmail(email);

    const payload = await verifyOTP({
        email: normalizedEmail,
        otp,
        purpose: "change-email",
        consume: true
    });

    if (payload.userId !== userId.toString()) {
        throw new Error("Unauthorized email change request.");
    }

    const existing = await findUserByEmail(payload.newEmail);

    if (
        existing &&
        existing._id.toString() !== userId.toString()
    ) {
        throw new Error(
            "This email is already registered to another account."
        );
    }

    return await updateUserById(userId, {
        email: payload.newEmail,
        isVerified: true
    });
};
