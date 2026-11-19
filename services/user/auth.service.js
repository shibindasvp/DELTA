import crypto from "crypto";
import User from "../../models/user.model.js";

import {
    createUser,
    findUserByEmail,
    findUserWithPassword,
    findUserById,
    updateUserById,
    updateUserPassword,
    findOAuthUser
} from "../../repositories/user.repository.js";

import {
    hashPassword,
    comparePassword
} from "../../utils/hashPassword.js";

import { generateToken } from "../../utils/generateToken.js";

import {
    createAndSendOTP,
    verifyOTP
} from "./otp.service.js";

import {
    normalizeEmail
} from "../../validations/auth.validation.js";

import { getOrCreateWallet } from "./wallet.service.js";

export const startSignup = async (data) => {
    const {
        name,
        fullName,
        email,
        password,
        phone,
        referralCode
    } = data;

    const normalizedEmail = normalizeEmail(email);

    const existingUser = await findUserByEmail(normalizedEmail);

    if (existingUser) {
        throw new Error("An account with this email already exists.");
    }

    const hashedPassword = await hashPassword(password);

    const userName = (name || fullName || "").trim();
    
    await createAndSendOTP({
        email: normalizedEmail,
        purpose: "signup",
        payload: {
            name: userName,
            email: normalizedEmail,
            phone: phone?.trim() || null,
            password: hashedPassword,
            referralCode: referralCode?.trim() || null
        }
    });

    return {
        email: normalizedEmail
    };
};

export const completeSignup = async ({ email, otp }) => {
    const normalizedEmail = normalizeEmail(email);

    const payload = await verifyOTP({
        email: normalizedEmail,
        otp,
        purpose: "signup",
        consume: true
    });

    const existingUser = await findUserByEmail(payload.email);

    if (existingUser) {
        throw new Error("An account with this email already exists.");
    }


    let referredBy = null;
    if (payload.referralCode) {
        const referrer = await User.findOne({
            referralCode: payload.referralCode.trim().toUpperCase()
        });
        if (referrer) {
            referredBy = referrer._id;
        }
    }

  
    const userReferralCode = "DLT-" + crypto.randomBytes(3).toString("hex").toUpperCase();

    const user = await createUser({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        authProvider: "local",
        isVerified: true,
        isBlocked: false,
        referralCode: userReferralCode,
        referredBy
    });

    try {
        await getOrCreateWallet(user._id);
    } catch (walletErr) {
        console.error("Failed to auto-create wallet on signup:", walletErr);
    }

    return {
        user,
        token: generateToken(user)
    };
};

export const loginUser = async (email, password) => {
    const normalizedEmail = normalizeEmail(email);

    const user = await findUserWithPassword(normalizedEmail);

    if (!user) {
        throw new Error("Invalid email or password.");
    }

    if (user.isBlocked) {
        throw new Error("Your account has been blocked by administrator.");
    }

    if (!user.isVerified) {
        throw new Error("Please verify your email before logging in.");
    }

    if (user.authProvider !== "local" && !user.password) {
        throw new Error(
            "This account uses Google Sign-In. Please continue with Google."
        );
    }

    if (!user.password) {
        throw new Error("Invalid email or password.");
    }

    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
        throw new Error("Invalid email or password.");
    }

    const userObject = user.toObject ? user.toObject() : { ...user };
    delete userObject.password;

    return {
        user: userObject,
        token: generateToken(user)
    };
};

export const startForgotPassword = async (email) => {
    const normalizedEmail = normalizeEmail(email);

    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
        throw new Error("No account found with this email address.");
    }

    if (user.isBlocked) {
        throw new Error("Your account is blocked. Please contact support.");
    }

    await createAndSendOTP({
        email: normalizedEmail,
        purpose: "forgot-password"
    });

    return {
        email: normalizedEmail
    };
};

export const verifyForgotPasswordOTP = async ({ email, otp }) => {
    return await verifyOTP({
        email: normalizeEmail(email),
        otp,
        purpose: "forgot-password",
        consume: false
    });
};

export const resetPassword = async ({
    email,
    otp,
    resetToken,
    password
}) => {
    const normalizedEmail = normalizeEmail(email);

    const verificationCode = resetToken || otp;

    if (!verificationCode) {
        throw new Error("Password reset verification is required.");
    }

    await verifyOTP({
        email: normalizedEmail,
        otp: verificationCode,
        purpose: "forgot-password",
        consume: true
    });

    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
        throw new Error("User not found.");
    }

    const hashedPassword = await hashPassword(password);

    await updateUserPassword(user._id, hashedPassword);

    return true;
};

export const loginOrCreateOAuthUser = async ({
    provider = "google",
    providerId,
    name,
    email,
    profileImage
}) => {
    if (!email) {
        throw new Error("Google did not provide an email address.");
    }

    if (!providerId) {
        throw new Error("Google account ID is missing.");
    }

    const normalizedEmail = normalizeEmail(email);

    let user = await findOAuthUser(provider, providerId);

    if (user) {
        if (user.isBlocked) {
            throw new Error("Your account has been blocked by administrator.");
        }

        // Ensure user has referralCode
        if (!user.referralCode) {
            const userReferralCode = "DLT-" + crypto.randomBytes(3).toString("hex").toUpperCase();
            user = await updateUserById(user._id, { referralCode: userReferralCode });
        }

        return user;
    }

    const existingUser = await findUserByEmail(normalizedEmail);

    if (existingUser) {
        if (existingUser.isBlocked) {
            throw new Error("Your account has been blocked by administrator.");
        }

        const userReferralCode = existingUser.referralCode || ("DLT-" + crypto.randomBytes(3).toString("hex").toUpperCase());

        user = await updateUserById(existingUser._id, {
            authProvider: provider,
            providerId,
            isVerified: true,
            referralCode: userReferralCode,
            profileImage: existingUser.profileImage || profileImage || null
        });

        return user;
    }

    const userReferralCode = "DLT-" + crypto.randomBytes(3).toString("hex").toUpperCase();

    const newUser = await createUser({
        name: name || "DELTA Valued Client",
        email: normalizedEmail,
        profileImage: profileImage || null,
        authProvider: provider,
        providerId,
        isVerified: true,
        isBlocked: false,
        referralCode: userReferralCode
    });

    try {
        await getOrCreateWallet(newUser._id);
    } catch (walletErr) {
        console.error("Failed to auto-create wallet on OAuth signup:", walletErr);
    }

    return newUser;
};

export const getUserById = async (userId) => {
    const user = await findUserById(userId);

    if (!user) {
        throw new Error("User not found.");
    }

    return user;
};

