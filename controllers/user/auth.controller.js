import {
    startSignup,
    completeSignup,
    loginUser,
    startForgotPassword,
    resetPassword as resetPasswordService
} from "../../services/user/auth.service.js";

import { generateToken } from "../../utils/generateToken.js";

import {
    validateSignup,
    validateLogin,
    validateForgotPassword,
    validateNewPassword
} from "../../validations/auth.validation.js";
import { formatErrorMessage } from "../../utils/error.js";


const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000
};

const setAuthCookie = (res, token) => {
    res.cookie("token", token, cookieOptions);
};

export const showLogin = (req, res) => {
    let success = null;
    let error = req.query.error || null;

    if (req.query.reset === "success") {
        success = "Your password has been successfully reset. Please sign in.";
    }

    if (req.query.registered === "success") {
        success = "Your account has been created successfully. Welcome to DELTA.";
    }

    if (req.query.logout === "success") {
        success = "You have been signed out of your session successfully.";
    }

    if (req.query.success) {
        success = req.query.success;
    }

    const rememberedEmail = req.cookies?.delta_remember_email || req.cookies?.delta_saved_email || "";
    const emailToUse = (req.query.email || rememberedEmail || "").trim();
    const isRemembered = Boolean(req.cookies?.delta_remember_email);
    const redirect = (req.query.redirect || "").trim();

    res.render("user/auth/login", {
        error,
        success,
        redirect,
        oldData: {
            email: emailToUse,
            remember: isRemembered,
            redirect
        }
    });
};

export const showSignup = (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    const refCode = (req.query.ref || req.query.referral || "").trim();
    const email = (req.query.email || "").trim();
    const name = (req.query.name || "").trim();
    const phone = (req.query.phone || "").trim();
    const redirect = (req.query.redirect || "").trim();
    res.render("user/auth/signup", {
        errors: {},
        error: req.query.error || null,
        success: req.query.success || null,
        redirect,
        oldData: {
            referralCode: refCode,
            email: email,
            name: name,
            phone: phone,
            redirect
        }
    });
};

export const signup = async (req, res, next) => {
    const rawRedirect = req.body.redirect || req.query.redirect || "";
    const redirect = (typeof rawRedirect === "string" && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//"))
        ? rawRedirect
        : "";

    try {
        const errors = validateSignup(req.body);

        if (Object.keys(errors).length > 0) {
            return res.status(400).render("user/auth/signup", {
                errors,
                redirect,
                oldData: req.body
            });
        }

        const { email } = await startSignup({
            name: req.body.name,
            fullName: req.body.fullName,
            email: req.body.email,
            password: req.body.password,
            phone: req.body.phone,
            referralCode: req.body.referralCode
        });

        if (req.session) {
            req.session.pendingEmail = email;
            req.session.pendingPurpose = "signup";
            if (redirect) {
                req.session.pendingRedirect = redirect;
            }
        }

        return res.redirect(
            "/otp/verify?email=" +
                encodeURIComponent(email) +
                "&purpose=signup"
        );
    } catch (error) {
        return res.status(400).render("user/auth/signup", {
            errors: {
                general: formatErrorMessage(error, "Unable to complete registration. Please review your details and try again.")
            },
            redirect,
            oldData: req.body
        });
    }
};

export const login = async (req, res, next) => {
    const rawRedirect = req.body.redirect || req.query.redirect || "/";
    const safeRedirect = (typeof rawRedirect === "string" && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//"))
        ? rawRedirect
        : "/";

    try {
        const errors = validateLogin(req.body);

        if (Object.keys(errors).length > 0) {
            return res.status(400).render("user/auth/login", {
                error: Object.values(errors)[0],
                success: null,
                redirect: safeRedirect !== "/" ? safeRedirect : null,
                oldData: req.body
            });
        }

        const { user, token } = await loginUser(
            req.body.email,
            req.body.password
        );

        setAuthCookie(res, token);

        const emailTrimmed = String(req.body.email || "").trim();
        const shouldRemember = req.body.remember === "true" || req.body.remember === "on" || req.body.remember === true;

        if (shouldRemember) {
            res.cookie("delta_remember_email", emailTrimmed, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: false,
                sameSite: "lax",
                path: "/"
            });
        } else {
            res.clearCookie("delta_remember_email", { path: "/" });
        }

        res.cookie("delta_saved_email", emailTrimmed, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: false,
            sameSite: "lax",
            path: "/"
        });

        return res.redirect(safeRedirect);
    } catch (error) {
        return res.status(401).render("user/auth/login", {
            error: formatErrorMessage(error, "Unable to sign in right now. Please check your credentials and try again."),
            success: null,
            redirect: safeRedirect !== "/" ? safeRedirect : null,
            oldData: req.body
        });
    }
};

export const logout = (req, res) => {
    res.clearCookie("token", { path: "/" });
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.redirect("/login?logout=success");
};

export const showForgotPassword = (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.render("user/auth/forgot-password", {
        errors: {},
        error: null,
        success: null,
        oldData: {
            email: (req.query.email || "").trim()
        }
    });
};

export const forgotPassword = async (req, res, next) => {
    try {
        const errors = validateForgotPassword(req.body);

        if (Object.keys(errors).length > 0) {
            return res.status(400).render("user/auth/forgot-password", {
                errors,
                error: Object.values(errors)[0],
                success: null,
                oldData: req.body
            });
        }

        const { email } = await startForgotPassword(req.body.email);

        if (req.session) {
            req.session.pendingEmail = email;
            req.session.pendingPurpose = "forgot-password";
        }

        return res.redirect(
            "/verify-otp?email=" +
                encodeURIComponent(email) +
                "&purpose=forgot-password"
        );
    } catch (error) {
        return res.status(400).render("user/auth/forgot-password", {
            errors: {},
            error: formatErrorMessage(error, "Unable to send password reset code. Please check your email and try again."),
            success: null,
            oldData: req.body
        });
    }
};

export const showResetPassword = (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    const { email, otp, token, resetToken } = req.query;

    if (!email) {
        return res.redirect("/forgot-password");
    }

    const verificationCode = token || otp || resetToken || "";

    res.render("user/auth/reset-password", {
        email: email.trim(),
        otp: verificationCode,
        resetToken: verificationCode,
        errors: {},
        error: null
    });
};

export const resetPassword = async (req, res, next) => {
    const { email, otp, resetToken, password, confirmPassword } = req.body;
    const verificationCode = (otp || resetToken || "").trim();

    try {
        const errors = validateNewPassword({ password, confirmPassword });

        if (Object.keys(errors).length > 0) {
            return res.status(400).render("user/auth/reset-password", {
                email: (email || "").trim(),
                otp: verificationCode,
                resetToken: verificationCode,
                errors,
                error: Object.values(errors)[0],
                oldData: req.body
            });
        }

        await resetPasswordService({
            email: (email || "").trim(),
            otp: verificationCode,
            resetToken: verificationCode,
            password
        });

        if (req.cookies?.token) {
            return res.redirect("/profile?password=changed");
        }
        return res.redirect("/login?reset=success");
    } catch (error) {
        return res.status(400).render("user/auth/reset-password", {
            email: (email || "").trim(),
            otp: verificationCode,
            resetToken: verificationCode,
            errors: {},
            error: formatErrorMessage(error, "Unable to reset password. Please check your verification code and try again."),
            oldData: req.body
        });
    }
};
