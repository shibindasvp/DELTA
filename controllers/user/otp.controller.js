import {
    completeSignup
} from "../../services/user/auth.service.js";

import {
    resendOTP as resendOTPService,
    verifyOTP
} from "../../services/user/otp.service.js";
import { formatErrorMessage, isAjaxRequest } from "../../utils/error.js";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000
};

export const showVerifyOTP = (
    req,
    res
) => {
    const email = (req.query.email || req.session?.pendingEmail || "").trim();
    const purpose = (req.query.purpose || req.session?.pendingPurpose || "signup").trim();

    if (!email) {
        if (purpose === "forgot-password") {
            return res.redirect("/forgot-password?error=Please%20enter%20your%20email%20address.");
        }
        return res.redirect("/signup?error=Please%20complete%20signup%20first.");
    }

    res.render(
        "user/auth/verify-otp",
        {
            email,
            purpose,
            error: req.query.error || null,
            success: req.query.success || null,
            otp: "",
            oldData: {}
        }
    );
};

export const verifySignupOTP =
    async (req, res) => {
        const email = (req.body.email || req.session?.pendingEmail || "").trim();
        const otp = String(req.body.otp || "").trim();

        try {
            if (!email) {
                return res.redirect("/signup?error=Session%20expired.%20Please%20sign%20up%20again.");
            }

            if (
                !otp ||
                !/^\d{6}$/.test(otp)
            ) {
                return res.status(400).render(
                    "user/auth/verify-otp",
                    {
                        email,
                        purpose: "signup",
                        error:
                            "Please enter the complete 6-digit OTP code.",
                        success: null,
                        otp: "",
                        oldData: { email }
                    }
                );
            }

            const result =
                await completeSignup({
                    email,
                    otp
                });

            let redirectTarget = "/?welcome=true";
            if (req.session?.pendingRedirect && typeof req.session.pendingRedirect === "string" && req.session.pendingRedirect.startsWith("/") && !req.session.pendingRedirect.startsWith("//")) {
                redirectTarget = req.session.pendingRedirect;
                delete req.session.pendingRedirect;
            }

            if (req.session) {
                delete req.session.pendingEmail;
                delete req.session.pendingPurpose;
            }

            res.cookie(
                "token",
                result.token,
                cookieOptions
            );

            return res.redirect(
                redirectTarget
            );
        } catch (error) {
            return res.status(400).render(
                "user/auth/verify-otp",
                {
                    email: email || req.body.email,
                    purpose: "signup",
                    error: formatErrorMessage(error, "OTP verification failed. Please check the code and try again."),
                    success: null,
                    otp: "",
                    oldData: { email }
                }
            );
        }
    };

export const verifyForgotOTP =
    async (req, res) => {
        const email = (req.body.email || req.session?.pendingEmail || "").trim();
        const otp = String(req.body.otp || "").trim();

        try {
            if (!email) {
                return res.redirect("/forgot-password?error=Session%20expired.%20Please%20try%20again.");
            }

            if (
                !otp ||
                !/^\d{6}$/.test(otp)
            ) {
                return res.status(400).render(
                    "user/auth/verify-otp",
                    {
                        email,
                        purpose:
                            "forgot-password",
                        error:
                            "Please enter the complete 6-digit OTP code.",
                        success: null,
                        otp: "",
                        oldData: { email }
                    }
                );
            }

            await verifyOTP({
                email,
                otp,
                purpose:
                    "forgot-password",
                consume: false
            });

            return res.render(
                "user/auth/reset-password",
                {
                    email,
                    otp,
                    resetToken: otp,
                    errors: {},
                    error: null,
                    oldData: req.body
                }
            );
        } catch (error) {
            return res.status(400).render(
                "user/auth/verify-otp",
                {
                    email: email || req.body.email,
                    purpose: "forgot-password",
                    error: formatErrorMessage(error, "Invalid or expired OTP code. Please check and try again."),
                    success: null,
                    otp: "",
                    oldData: { email }
                }
            );
        }
    };

export const resendOTP = async (req, res) => {
    try {
        const email = (req.body.email || req.session?.pendingEmail || "").trim();
        const purpose = (req.body.purpose || req.session?.pendingPurpose || "signup").trim();

        if (!email) {
            throw new Error("Email is required.");
        }

        await resendOTPService({ email, purpose });

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({
                success: true,
                message: "A new 6-digit verification code has been dispatched to your email."
            });
        }

        return res.render("user/auth/verify-otp", {
            email,
            purpose,
            error: null,
            success: "A new 6-digit verification code has been sent.",
            otp: "",
            oldData: { email }
        });
    } catch (error) {
        const message = formatErrorMessage(error, "Unable to resend verification code right now. Please try again.");
        if (isAjaxRequest(req)) {
            return res.status(400).json({ success: false, message });
        }
        const email = (req.body.email || req.session?.pendingEmail || "").trim();
        return res.status(400).render("user/auth/verify-otp", {
            email,
            purpose: req.body.purpose || req.session?.pendingPurpose || "signup",
            error: message,
            success: null,
            otp: "",
            oldData: { email }
        });
    }
};

export const verifyGoogleOTP = async (req, res) => {
    const email = (req.body.email || req.session?.pendingEmail || "").trim();
    const otp = String(req.body.otp || "").trim();

    try {
        if (!email) {
            return res.redirect("/login?error=Session%20expired.%20Please%20log%20in%20again.");
        }

        if (!otp || !/^\d{6}$/.test(otp)) {
            return res.status(400).render("user/auth/verify-otp", {
                email,
                purpose: "google-signin",
                error: "Please enter the complete 6-digit OTP code.",
                success: null,
                otp: "",
                oldData: { email }
            });
        }

        const payload = await verifyOTP({
            email,
            otp,
            purpose: "google-signin",
            consume: true
        });

        const { loginOrCreateOAuthUser } = await import("../../services/user/auth.service.js");
        const { generateToken } = await import("../../utils/generateToken.js");

        const user = await loginOrCreateOAuthUser({
            provider: payload.provider || "google",
            providerId: payload.providerId,
            name: payload.name,
            email: payload.email || email,
            profileImage: payload.profileImage
        });

        if (req.session) {
            delete req.session.pendingEmail;
            delete req.session.pendingPurpose;
        }

        const token = generateToken(user);

        res.cookie("token", token, cookieOptions);

        return res.redirect("/?welcome=true");
    } catch (error) {
        return res.status(400).render("user/auth/verify-otp", {
            email: email || req.body.email,
            purpose: "google-signin",
            error: formatErrorMessage(error, "Google sign-in verification failed. Please check the code and try again."),
            success: null,
            otp: "",
            oldData: { email }
        });
    }
};
