import OTP from "../models/otp.model.js";

export const createOTP = async (data) => {
    return await OTP.create(data);
};

export const findOTP = async (
    email,
    purpose
) => {
    return await OTP.findOne({
        email: String(email || "").toLowerCase().trim(),
        purpose
    }).select("+otp");
};

export const deleteOTP = async (
    email,
    purpose
) => {
    return await OTP.deleteMany({
        email: String(email || "").toLowerCase().trim(),
        purpose
    });
};

export const incrementOTPAttempts = async (
    otpId
) => {
    return await OTP.findByIdAndUpdate(
        otpId,
        {
            $inc: {
                attempts: 1
            }
        }
    );
};