import express from "express";
import passport from "../../config/passport.js";

import {
    showLogin,
    showSignup,
    signup,
    login,
    logout,
    showForgotPassword,
    forgotPassword,
    showResetPassword,
    resetPassword
} from "../../controllers/user/auth.controller.js";

import { isGuest } from "../../middlewares/guest.middleware.js";
import { formatErrorMessage } from "../../utils/error.js";


const router = express.Router();


router.get("/login", isGuest, showLogin);
router.post("/login", isGuest, login);


router.get("/signup", isGuest, showSignup);
router.post("/signup", isGuest, signup);


router.get("/register", isGuest, showSignup);
router.post("/register", isGuest, signup);


router.post("/logout", logout);
router.get("/logout", logout);


router.get(
    "/forgot-password",
    showForgotPassword
);

router.post(
    "/forgot-password",
    forgotPassword
);


router.get(
    "/reset-password",
    showResetPassword
);

router.post(
    "/reset-password",
    resetPassword
);


router.get(
    "/auth/google",
    (req, res, next) => {
        if (
            !process.env.GOOGLE_CLIENT_ID ||
            !process.env.GOOGLE_CLIENT_SECRET ||
            !process.env.GOOGLE_CALLBACK_URL
        ) {
            return res.status(503).render(
                "user/auth/login",
                {
                    error:
                        "Google Sign-In is currently unavailable. Please use email and password.",
                    success: null,
                    oldData: {}
                }
            );
        }

        const rawRedirect = (req.query.redirect || "").trim();
        const state = (rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")) ? rawRedirect : "";
        return passport.authenticate(
            "google",
            {
                scope: ["profile", "email"],
                session: false,
                prompt: "select_account",
                state: state || undefined
            }
        )(req, res, next);
    }
);

router.get(
    "/auth/google/callback",
    (req, res, next) => {
        // If user cancelled consent or Google returned an error query
        if (req.query.error) {
            const errorDesc =
                req.query.error_description ||
                (req.query.error === "access_denied"
                    ? "Google sign-in was cancelled."
                    : "Google authentication failed: " + req.query.error);
            return res.redirect("/login?error=" + encodeURIComponent(errorDesc));
        }

        // If no code parameter was provided
        if (!req.query.code) {
            return res.redirect(
                "/login?error=" + encodeURIComponent("Google authorization code missing. Please sign in again.")
            );
        }

        passport.authenticate("google", { session: false }, async (err, googleProfile, info) => {
            if (err || !googleProfile) {
                console.error("Google authentication error:", err || info);
                let friendlyMessage = "Google authentication failed. Please try again.";
                if (err?.code === "invalid_grant" || err?.message?.includes("Malformed auth code")) {
                    friendlyMessage = "This Google sign-in authorization link has expired or has already been used. Please click 'Sign in with Google' again.";
                } else if (err?.message) {
                    friendlyMessage = err.message;
                } else if (info?.message) {
                    friendlyMessage = info.message;
                }
                return res.redirect("/login?error=" + encodeURIComponent(friendlyMessage));
            }

            try {
                const email = googleProfile.email;
                if (!email) {
                    return res.redirect("/login?error=" + encodeURIComponent("Google did not provide an email address."));
                }

                const { loginOrCreateOAuthUser } = await import("../../services/user/auth.service.js");
                const { generateToken } = await import("../../utils/generateToken.js");

                const user = await loginOrCreateOAuthUser({
                    provider: "google",
                    providerId: googleProfile.providerId || googleProfile.id,
                    name: googleProfile.name,
                    email,
                    profileImage: googleProfile.profileImage
                });

                const token = generateToken(user);

                res.cookie("token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                    path: "/",
                    maxAge: 24 * 60 * 60 * 1000
                });

                if (req.session) {
                    req.session.user = {
                        _id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role
                    };
                }

                const returnTo = req.query.state;
                const safeReturnTo = (returnTo && typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//"))
                    ? returnTo
                    : "/?welcome=true";
                return res.redirect(safeReturnTo);
            } catch (error) {
                console.error("Google callback user processing error:", error);
                return res.redirect(
                    "/login?error=" + encodeURIComponent(
                        formatErrorMessage(error, "Google sign-in failed. Please try again or use your email and password.")
                    )
                );
            }
        })(req, res, next);
    }
);

export default router;