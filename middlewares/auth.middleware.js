import jwt from "jsonwebtoken";
import { getUserById } from "../services/user/auth.service.js";
import { isAjaxRequest, formatErrorMessage } from "../utils/error.js";

export const preventCache = (req, res, next) => {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
};

export const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
});

export const isAuthenticated = async (req, res, next) => {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    try {
        const token = req.cookies?.token;

        if (!token) {
            if (isAjaxRequest(req)) {
                return res.status(401).json({
                    success: false,
                    message: "Please sign in to continue.",
                    redirect: "/login"
                });
            }
            return res.redirect("/login?redirect=" + encodeURIComponent(req.originalUrl || "/cart"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded?.userId) {
            res.clearCookie("token", getCookieOptions());
            if (isAjaxRequest(req)) {
                return res.status(401).json({
                    success: false,
                    message: "Session expired. Please sign in.",
                    redirect: "/login"
                });
            }
            return res.redirect("/login");
        }

        const user = await getUserById(decoded.userId);

        if (!user) {
            res.clearCookie("token", getCookieOptions());
            if (isAjaxRequest(req)) {
                return res.status(401).json({
                    success: false,
                    message: "User not found. Please sign in.",
                    redirect: "/login"
                });
            }
            return res.redirect("/login");
        }

        if (user.isBlocked) {
            res.clearCookie("token", getCookieOptions());
            if (isAjaxRequest(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Your account has been restricted.",
                    redirect: "/login?error=" + encodeURIComponent("Your account has been blocked")
                });
            }
            return res.redirect("/login?error=" + encodeURIComponent("Your account has been blocked"));
        }

        req.user = {
            userId: user._id.toString(),
            _id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            authProvider: user.authProvider
        };

        res.locals.currentUser = req.user;
        next();
    } catch (error) {
        res.clearCookie("token", getCookieOptions());
        const message = formatErrorMessage(error, "Your session has expired. Please sign in again.");
        if (isAjaxRequest(req)) {
            return res.status(401).json({
                success: false,
                message,
                redirect: "/login"
            });
        }
        return res.redirect(
            error?.name === "TokenExpiredError"
                ? "/login?error=" + encodeURIComponent(message)
                : "/login"
        );
    }
};

export const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.token;
        if (!token) {
            req.user = null;
            res.locals.currentUser = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.userId) {
            req.user = null;
            res.locals.currentUser = null;
            return next();
        }

        const user = await getUserById(decoded.userId);
        if (!user || user.isBlocked) {
            res.clearCookie("token", getCookieOptions());
            req.user = null;
            res.locals.currentUser = null;
            return next();
        }

        req.user = {
            userId: user._id.toString(),
            _id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            authProvider: user.authProvider
        };

        res.locals.currentUser = req.user;
        next();
    } catch (error) {
        req.user = null;
        res.locals.currentUser = null;
        next();
    }
};
