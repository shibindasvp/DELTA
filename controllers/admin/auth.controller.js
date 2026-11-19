import {
    loginAdmin,
    startAdminForgotPassword,
    resetAdminPassword as resetAdminPasswordService
} from "../../services/admin/auth.service.js";

import {
    validateAdminLogin,
    validateAdminForgotPassword,
    validateAdminResetPassword
} from "../../validations/admin.validation.js";
import { formatErrorMessage } from "../../utils/error.js";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
};

export const showAdminLogin = (req, res) => {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    let success = null;
    let error = req.query.error || null;

    if (req.query.reset === "success") {
        success = "Administrator credentials updated successfully. Please sign in.";
    }

    const email = (req.query.email || process.env.ADMIN_EMAIL || "admin@delta.com").trim();

    res.render("admin/auth/login", {
        error,
        success,
        oldEmail: email,
        oldData: {
            email,
            password: ""
        }
    });
};

export const adminLogin = async (req, res, next) => {
    try {
        const errors = validateAdminLogin(req.body);

        if (Object.keys(errors).length > 0) {
            return res.status(400).render("admin/auth/login", {
                error: Object.values(errors)[0],
                success: null,
                oldEmail: req.body.email,
                oldData: req.body
            });
        }

        const { admin, token } = await loginAdmin(req.body.email, req.body.password);

        res.cookie("adminToken", token, {
            ...cookieOptions,
            maxAge: 24 * 60 * 60 * 1000
        });
        return res.redirect("/admin/dashboard");
    } catch (error) {
        return res.status(401).render("admin/auth/login", {
            error: formatErrorMessage(error, "Unable to sign in right now. Please check your credentials and try again."),
            success: null,
            oldEmail: req.body.email,
            oldData: req.body
        });
    }
};

export const adminLogout = (req, res) => {
    res.clearCookie("adminToken", cookieOptions);
    res.clearCookie("token", cookieOptions);

    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    return res.redirect("/admin/login");
};

export const showAdminForgotPassword = (req, res) => {
    const email = (req.query.email || process.env.ADMIN_EMAIL || "admin@delta.com").trim();
    res.render("admin/auth/forgot-password", {
        error: null,
        success: null,
        oldEmail: email,
        oldData: {
            email
        }
    });
};

export const adminForgotPassword = async (req, res, next) => {
    try {
        const errors = validateAdminForgotPassword(req.body);

        if (Object.keys(errors).length > 0) {
            return res.status(400).render("admin/auth/forgot-password", {
                error: Object.values(errors)[0],
                success: null,
                oldEmail: req.body.email,
                oldData: req.body
            });
        }

        const { email } = await startAdminForgotPassword(req.body.email);

        return res.redirect(
            "/admin/reset-password?email=" + encodeURIComponent(email)
        );
    } catch (error) {
        return res.status(400).render("admin/auth/forgot-password", {
            error: formatErrorMessage(error, "Unable to dispatch verification code right now. Please try again."),
            success: null,
            oldEmail: req.body.email,
            oldData: req.body
        });
    }
};

export const showAdminResetPassword = (req, res) => {
    const email = (req.query.email || "").trim();
    if (!email) {
        return res.redirect("/admin/forgot-password");
    }

    res.render("admin/auth/reset-password", {
        email,
        error: null,
        success: null,
        otp: "",
        oldData: {
            email,
            otp: "",
            password: "",
            confirmPassword: ""
        }
    });
};

export const adminResetPassword = async (req, res, next) => {
    try {
        const errors = validateAdminResetPassword(req.body);

        if (Object.keys(errors).length > 0) {
            return res.status(400).render("admin/auth/reset-password", {
                email: req.body.email,
                error: Object.values(errors)[0],
                success: null,
                otp: req.body.otp,
                oldData: req.body
            });
        }

        await resetAdminPasswordService({
            email: req.body.email,
            otp: req.body.otp,
            password: req.body.password
        });

        return res.redirect(
            "/admin/login?reset=success&email=" + encodeURIComponent(req.body.email)
        );
    } catch (error) {
        return res.status(400).render("admin/auth/reset-password", {
            email: req.body.email,
            error: formatErrorMessage(error, "Unable to reset password. Please verify your code and try again."),
            success: null,
            otp: req.body.otp,
            oldData: req.body
        });
    }
};

export const adminResendOTP = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.redirect("/admin/forgot-password");
        }

        await startAdminForgotPassword(email);

        res.render("admin/auth/reset-password", {
            email,
            error: null,
            success: "A new 6-digit verification code has been dispatched to your email.",
            otp: "",
            oldData: req.body
        });
    } catch (error) {
        res.status(400).render("admin/auth/reset-password", {
            email: req.body.email,
            error: formatErrorMessage(error, "Unable to resend verification code right now. Please try again."),
            success: null,
            otp: req.body.otp,
            oldData: req.body
        });
    }
};
