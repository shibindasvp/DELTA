import {
    createOTP,
    findOTP,
    deleteOTP,
    incrementOTPAttempts
} from "../../repositories/otp.repository.js";

import { generateOTP } from "../../utils/generateOTP.js";

import {
    sendOTPEmail
} from "../../utils/email.js";

import {
    OTP_EXPIRY_MS,
    OTP_EXPIRY_SECONDS
} from "../../utils/constants.js";

import {
    normalizeEmail
} from "../../validations/auth.validation.js";

export const createAndSendOTP = async ({
    email,
    purpose,
    payload = {}
}) => {
    const normalizedEmail =
        normalizeEmail(email);

    const otp = generateOTP();

    const expiresAt =
        new Date(
            Date.now() +
            OTP_EXPIRY_MS
        );

    await deleteOTP(
        normalizedEmail,
        purpose
    );

    await createOTP({
        email: normalizedEmail,
        otp,
        purpose,
        payload,
        expiresAt,
        attempts: 0
    });

    await sendOTPEmail({
        to: normalizedEmail,
        otp,
        purpose
    });

    return {
        email: normalizedEmail,
        expiresAt,
        expirySeconds:
            OTP_EXPIRY_SECONDS
    };
};

export const resendOTP = async ({
    email,
    purpose
}) => {
    const normalizedEmail =
        normalizeEmail(email);

    const existingRecord =
        await findOTP(
            normalizedEmail,
            purpose
        );

    const payload =
        existingRecord?.payload || {};

    return await createAndSendOTP({
        email: normalizedEmail,
        purpose,
        payload
    });
};

export const verifyOTP = async ({
    email,
    otp,
    purpose,
    consume = true
}) => {
    const normalizedEmail =
        normalizeEmail(email);

    const record =
        await findOTP(
            normalizedEmail,
            purpose
        );

    if (!record) {
        throw new Error(
            "OTP expired or not found. Please request a new code."
        );
    }

    if (
        new Date(record.expiresAt).getTime() <
        Date.now()
    ) {
        await deleteOTP(
            normalizedEmail,
            purpose
        );

        throw new Error(
            "OTP has expired. Please request a new code."
        );
    }

    if (record.attempts >= 5) {
        await deleteOTP(
            normalizedEmail,
            purpose
        );

        throw new Error(
            "Too many incorrect attempts. Please request a new OTP."
        );
    }

    if (
        String(record.otp).trim() !==
        String(otp).trim()
    ) {
        await incrementOTPAttempts(
            record._id
        );

        throw new Error(
            "Invalid OTP code. Please enter the correct 6-digit code."
        );
    }

    const payload =
        record.payload || {};

    if (consume) {
        await deleteOTP(
            normalizedEmail,
            purpose
        );
    }

    return payload;
};