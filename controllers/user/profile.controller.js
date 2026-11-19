import Order from "../../models/order.model.js";
import {
    getProfile,
    updateProfile,
    changePassword,
    startEmailChange,
    verifyEmailChange
} from "../../services/user/profile.service.js";
import { findUserWithPassword } from "../../repositories/user.repository.js";

import {
    validateProfile,
    validateChangePassword,
    validateEmailChange
} from "../../validations/profile.validation.js";
import { formatErrorMessage } from "../../utils/error.js";

export const showProfile = async (req, res, next) => {
    try {
        const userId = req.user ? (req.user.userId || req.user._id) : null;
        const profileData = await getProfile(userId);

        const userWithPass = await findUserWithPassword(profileData.user.email);
        const hasPassword = Boolean(userWithPass && userWithPass.password);

        const flashMessage = req.query.updated === "success"
            ? "Profile updated successfully."
            : req.query.password === "changed"
            ? "Your password has been changed successfully."
            : req.query.email === "changed"
            ? "Your email has been verified and updated successfully."
            : req.query.success
            ? req.query.success
            : null;

        return res.render("user/profile/profile", {
            user: profileData.user,
            hasPassword,
            addresses: profileData.addresses,
            defaultAddress: profileData.defaultAddress,
            success: flashMessage,
            error: req.query.error || null
        });
    } catch (error) {
        next(error);
    }
};

export const showEditProfile = async (req, res, next) => {
    try {
        const { user } = await getProfile(req.user.userId);

        res.render("user/profile/edit-profile", {
            user,
            errors: {},
            error: null
        });
    } catch (error) {
        next(error);
    }
};

export const editProfile = async (req, res, next) => {
    try {
        const errors = validateProfile(req.body);
        if (req.fileValidationError) {
            errors.profileImage = req.fileValidationError;
        }

        if (Object.keys(errors).length > 0) {
            const { user } = await getProfile(req.user.userId);
            const userObj = user && user.toObject ? user.toObject() : (user || {});
            return res.status(400).render("user/profile/edit-profile", {
                user: {
                    ...userObj,
                    ...req.body
                },
                errors,
                error: null
            });
        }

        const updatePayload = {
            name: String(req.body.name || req.body.fullName || "").trim(),
            phone: String(req.body.phone || "").trim()
        };

        if (req.file) {
            updatePayload.profileImage = `/uploads/profile/${req.file.filename}`;
        }

        await updateProfile(req.user.userId, updatePayload);

        res.redirect("/profile?updated=success");
    } catch (error) {
        const { user } = await getProfile(req.user.userId).catch(() => ({ user: req.user || {} }));
        const userObj = user && user.toObject ? user.toObject() : (user || {});
        res.status(400).render("user/profile/edit-profile", {
            user: {
                ...userObj,
                ...req.body
            },
            errors: {},
            error: formatErrorMessage(error, "Unable to update profile right now. Please check your entries and try again.")
        });
    }
};

export const showChangePassword = async (req, res, next) => {
    try {
        const { user } = await getProfile(req.user.userId);
        const userWithPass = await findUserWithPassword(user.email);
        const hasPassword = Boolean(userWithPass && userWithPass.password);
        const isGoogleUser = Boolean(user.authProvider === "google" || user.providerId || user.googleId);

        if (isGoogleUser && !hasPassword) {
            return res.redirect(
                "/profile?error=" +
                encodeURIComponent("Google-linked accounts cannot change password directly initially. Please use Reset Password first to establish an account password.")
            );
        }

        res.render("user/profile/change-password", {
            user,
            hasPassword,
            errors: {},
            error: null
        });
    } catch (error) {
        next(error);
    }
};

export const changeUserPassword = async (req, res, next) => {
    try {
        const { user } = await getProfile(req.user.userId);
        const userWithPass = await findUserWithPassword(user.email);
        const hasPassword = Boolean(userWithPass && userWithPass.password);
        const isGoogleUser = Boolean(user.authProvider === "google" || user.providerId || user.googleId);

        if (isGoogleUser && !hasPassword) {
            return res.status(400).render("user/profile/change-password", {
                user,
                hasPassword,
                errors: {},
                error: "Google-linked accounts cannot change password directly initially. Please use Reset Password first to establish an account password.",
                oldData: req.body
            });
        }

        const errors = validateChangePassword(req.body, true);

        if (Object.keys(errors).length > 0) {
            return res.status(400).render("user/profile/change-password", {
                user,
                hasPassword,
                errors,
                error: null,
                oldData: req.body
            });
        }

        await changePassword({
            userId: req.user.userId,
            currentPassword: req.body.currentPassword,
            newPassword: req.body.newPassword
        });

        res.redirect("/profile?password=changed");
    } catch (error) {
        const { user } = await getProfile(req.user.userId).catch(() => ({ user: req.user || {} }));
        const userWithPass = user?.email ? await findUserWithPassword(user.email).catch(() => null) : null;
        const hasPassword = Boolean(userWithPass && userWithPass.password);

        res.status(400).render("user/profile/change-password", {
            user,
            hasPassword,
            errors: {},
            error: formatErrorMessage(error, "Unable to change password. Please verify your current password and try again."),
            oldData: req.body
        });
    }
};

export const showChangeEmail = async (req, res, next) => {
    try {
        const { user } = await getProfile(req.user.userId);
        if (user.authProvider === "google" || user.providerId) {
            return res.redirect("/profile?error=" + encodeURIComponent("Google-linked accounts cannot change their registered email address."));
        }
        res.render("user/profile/change-email", {
            user,
            error: null,
            success: null,
            oldData: {
                newEmail: (req.query.email || "").trim()
            }
        });
    } catch (error) {
        next(error);
    }
};

export const requestEmailChange = async (req, res, next) => {
    try {
        const { user } = await getProfile(req.user.userId);
        if (user.authProvider === "google" || user.providerId) {
            return res.redirect("/profile?error=" + encodeURIComponent("Google-linked accounts cannot change their registered email address."));
        }

        const newEmail = (req.body.newEmail || "").trim().toLowerCase();
        const validationError = validateEmailChange(newEmail);
        
        if (validationError) {
            return res.status(400).render("user/profile/change-email", {
                user,
                error: validationError,
                success: null,
                oldData: req.body,
                newEmail
            });
        }

        if (user.email.toLowerCase() === newEmail) {
            return res.status(400).render("user/profile/change-email", {
                user,
                error: "The new email address cannot be identical to your current email.",
                success: null,
                oldData: req.body,
                newEmail
            });
        }

        const result = await startEmailChange({
            userId: req.user.userId,
            newEmail
        });

        return res.redirect("/profile/verify-email?email=" + encodeURIComponent(result.email));
    } catch (error) {
        const { user } = await getProfile(req.user.userId).catch(() => ({ user: req.user || {} }));
        return res.status(400).render("user/profile/change-email", {
            user,
            error: formatErrorMessage(error, "Unable to start email update. Please verify the email address and try again."),
            success: null,
            oldData: req.body,
            newEmail: req.body.newEmail
        });
    }
};

export const showVerifyEmail = (req, res) => {
    const newEmail = (req.query.email || "").trim();
    if (!newEmail) {
        return res.redirect("/profile/change-email");
    }

    res.render("user/profile/verify-email", {
        newEmail,
        error: null,
        success: req.query.sent === "true" ? "Verification code sent to your new email." : null,
        otp: "",
        oldData: {}
    });
};

export const verifyNewEmail = async (req, res, next) => {
    try {
        const { newEmail, email, otp } = req.body;
        const targetEmail = (newEmail || email || "").trim().toLowerCase();

        if (!targetEmail) {
            return res.redirect("/profile/change-email");
        }

        if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).render("user/profile/verify-email", {
                newEmail: targetEmail,
                error: "Please enter the complete 6-digit OTP code.",
                success: null,
                otp: "",
                oldData: { newEmail: targetEmail }
            });
        }

        await verifyEmailChange({
            email: targetEmail,
            otp: String(otp).trim(),
            userId: req.user.userId
        });

        return res.redirect("/profile?email=changed");
    } catch (error) {
        return res.status(400).render("user/profile/verify-email", {
            newEmail: req.body.newEmail || req.body.email,
            error: formatErrorMessage(error, "Email verification failed. Please check the OTP code and try again."),
            success: null,
            otp: "",
            oldData: { newEmail: req.body.newEmail || req.body.email }
        });
    }
};

export const resendEmailOTP = async (req, res, next) => {
    try {
        const newEmail = (req.body.newEmail || "").trim().toLowerCase();
        if (!newEmail) {
            return res.redirect("/profile/change-email");
        }

        await startEmailChange({
            userId: req.user.userId,
            newEmail
        });

        return res.render("user/profile/verify-email", {
            newEmail,
            error: null,
            success: "A new 6-digit verification code has been dispatched to your email.",
            otp: "",
            oldData: req.body
        });
    } catch (error) {
        return res.status(400).render("user/profile/verify-email", {
            newEmail: req.body.newEmail,
            error: formatErrorMessage(error, "Unable to resend verification code right now. Please try again."),
            success: null,
            otp: "",
            oldData: req.body
        });
    }
};
