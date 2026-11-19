import {
    NAME_REGEX,
    PHONE_REGEX,
    EMAIL_REGEX,
    PASSWORD_REGEX
} from "../utils/constants.js";

export const validateProfile = (data = {}) => {
    const errors = {};

    const name = String(
        data.name || data.fullName || ""
    ).trim();

    const phone = String(
        data.phone || ""
    ).trim();

    if (!name) {
        errors.name = "Full Legal Name is required.";
    } else if (name.length < 3) {
        errors.name = "Name must be at least 3 characters long.";
    } else if (name.length > 50) {
        errors.name = "Name cannot exceed 50 characters.";
    } else if (!NAME_REGEX.test(name)) {
        errors.name = "Name must contain only letters, spaces, hyphens or apostrophes.";
    }

    if (phone) {
        if (!PHONE_REGEX.test(phone)) {
            errors.phone = "Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.";
        }
    }

    return errors;
};

export const validateChangePassword = (data = {}, requireCurrentPassword = true) => {
    const errors = {};

    const currentPassword = String(data.currentPassword || "");
    const newPassword = String(data.newPassword || "");
    const confirmPassword = String(data.confirmPassword || "");

    if (requireCurrentPassword && !currentPassword) {
        errors.currentPassword = "Current password is required.";
    }

    if (!newPassword) {
        errors.newPassword = "New password is required.";
    } else if (!PASSWORD_REGEX.test(newPassword)) {
        errors.newPassword =
            "Password must contain 8-50 characters with uppercase, lowercase, number and special character.";
    }

    if (!confirmPassword) {
        errors.confirmPassword = "Confirm password is required.";
    } else if (newPassword && newPassword !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
};

export const validateEmailChange = (email) => {
    const normalizedEmail =
        String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
        return "New email address is required.";
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
        return "Please enter a valid email address.";
    }

    return null;
};