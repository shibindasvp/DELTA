import { EMAIL_REGEX } from "../utils/constants.js";

export const validateAdminLogin = ({ email, password }) => {
    const errors = {};
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
        errors.email = "Admin email is required";
    } else if (!EMAIL_REGEX.test(normalizedEmail)) {
        errors.email = "Please provide a valid email address";
    }

    if (!password) {
        errors.password = "Password is required";
    }

    return errors;
};

export const validateAdminForgotPassword = ({ email }) => {
    const errors = {};
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
        errors.email = "Administrator email is required";
    } else if (!EMAIL_REGEX.test(normalizedEmail)) {
        errors.email = "Please provide a valid administrator email address";
    }

    return errors;
};

export const validateAdminResetPassword = ({ email, otp, password, confirmPassword }) => {
    const errors = {};
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
        errors.email = "Administrator email is required";
    }

    if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
        errors.otp = "Please enter the complete 6-digit verification code";
    }

    if (!password) {
        errors.password = "New password is required";
    } else if (password.length < 6) {
        errors.password = "Password must be at least 6 characters long";
    }

    if (confirmPassword && password !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
    }

    return errors;
};
