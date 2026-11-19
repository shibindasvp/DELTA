import {
    NAME_REGEX,
    EMAIL_REGEX,
    PHONE_REGEX,
    PASSWORD_REGEX
} from "../utils/constants.js";

export const normalizeEmail = (email = "") => {
    return String(email).trim().toLowerCase();
};

export const validateSignup = (data = {}) => {
    const errors = {};

    const name = String(
        data.name || data.fullName || ""
    ).trim();

    const email = normalizeEmail(data.email);
    const password = String(data.password || "");
    const confirmPassword = String(
        data.confirmPassword || data.confirm_password || ""
    );

    if (!name) {
        errors.name = "Full name is required.";
    } else if (!NAME_REGEX.test(name)) {
        errors.name =
            "Name must contain only letters and spaces and be 3-50 characters.";
    }

    if (!email) {
        errors.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(email)) {
        errors.email = "Please enter a valid email address.";
    }

    if (!password) {
        errors.password = "Password is required.";
    } else if (!PASSWORD_REGEX.test(password)) {
        errors.password =
            "Password must contain 8-50 characters with uppercase, lowercase, number and special character.";
    }

    if (!confirmPassword) {
        errors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
    }

    if (data.phone && !PHONE_REGEX.test(String(data.phone).trim())) {
        errors.phone = "Please enter a valid phone number.";
    }

    return errors;
};

export const validateLogin = (data = {}) => {
    const errors = {};

    const email = normalizeEmail(data.email);
    const password = String(data.password || "");

    if (!email) {
        errors.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(email)) {
        errors.email = "Please enter a valid email address.";
    }

    if (!password) {
        errors.password = "Password is required.";
    }

    return errors;
};

export const validateForgotPassword = (data = {}) => {
    const errors = {};
    const email = typeof data === "string" ? normalizeEmail(data) : normalizeEmail(data.email);

    if (!email) {
        errors.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(email)) {
        errors.email = "Please enter a valid email address.";
    }

    return errors;
};

export const validateNewPassword = (data = {}) => {
    const errors = {};

    const password = String(data.password || "");
    const confirmPassword = String(
        data.confirmPassword || data.confirm_password || ""
    );

    if (!password) {
        errors.password = "New password is required.";
    } else if (!PASSWORD_REGEX.test(password)) {
        errors.password =
            "Password must contain 8-50 characters with uppercase, lowercase, number and special character.";
    }

    if (!confirmPassword) {
        errors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
};