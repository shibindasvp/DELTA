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
                state: state || undefined
            }
        )(req, res, next);
    }
);

router.get(
    "/auth/google/callback",
    passport.authenticate(
        "google",
        {
            session: false,
            failureRedirect:
                "/login?error=Google%20authentication%20failed"
        }
    ),
    async (req, res) => {
        try {
            const googleProfile = req.user;
            const email = googleProfile.email;

            if (!email) {
                return res.redirect("/login?error=Google%20did%20not%20provide%20an%20email%20address.");
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

            const returnTo = req.query.state;
            const safeReturnTo = (returnTo && typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//"))
                ? returnTo
                : "/?welcome=true";
            return res.redirect(safeReturnTo);
        } catch (error) {
            console.error(
                "Google callback error:",
                error
            );

            return res.redirect(
                "/login?error=" + encodeURIComponent(
                    formatErrorMessage(error, "Google sign-in failed. Please try again or use your email and password.")
                )
            );
        }
    }
);

export default router;