import { verifyToken } from "../utils/generateToken.js";
import { findAdminById } from "../repositories/admin.repository.js";
import { isAjaxRequest, formatErrorMessage } from "../utils/error.js";

export const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
});

export const preventAdminCache = (req, res, next) => {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
};


export const isAdminAuthenticated = async (req, res, next) => {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    const sendAdminUnauthorized = (message, statusCode = 401, withRedirectError = false) => {
        if (isAjaxRequest(req)) {
            return res.status(statusCode).json({
                success: false,
                message,
                redirect: "/admin/login"
            });
        }
        const redirectUrl = withRedirectError
            ? "/admin/login?error=" + encodeURIComponent(message)
            : "/admin/login";
        return res.redirect(redirectUrl);
    };

    try {
        const token = req.cookies?.adminToken || req.cookies?.token;

        if (!token) {
            return sendAdminUnauthorized("Please sign in with an administrator account to continue.");
        }

        const decoded = verifyToken(token);

        if (decoded?.role !== "admin") {
            res.clearCookie("adminToken", getCookieOptions());
            res.clearCookie("token", getCookieOptions());
            return sendAdminUnauthorized("Administrator access is required for this section.", 403, true);
        }

        const admin = await findAdminById(decoded.userId || decoded._id);
        if (!admin) {
            res.clearCookie("adminToken", getCookieOptions());
            res.clearCookie("token", getCookieOptions());
            return sendAdminUnauthorized("Administrator account not found. Please sign in again.", 401, true);
        }

        if (admin.isBlocked) {
            res.clearCookie("adminToken", getCookieOptions());
            res.clearCookie("token", getCookieOptions());
            return sendAdminUnauthorized("Your administrator account has been blocked.", 403, true);
        }

        req.admin = {
            adminId: admin._id.toString(),
            name: admin.name,
            email: admin.email,
            role: "admin"
        };

        res.locals.currentAdmin = req.admin;
        next();
    } catch (error) {
        res.clearCookie("adminToken", getCookieOptions());
        res.clearCookie("token", getCookieOptions());
        const message = formatErrorMessage(error, "Your administrator session has expired. Please sign in again.");
        return sendAdminUnauthorized(message, 401, error?.name === "TokenExpiredError");
    }
};

export const isAdminGuest = (req, res, next) => {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    try {
        const token = req.cookies?.adminToken || req.cookies?.token;
        if (token) {
            const decoded = verifyToken(token);
            if (decoded?.role === "admin") {
                return res.redirect("/admin/dashboard");
            }
        }
    } catch (err) {
        res.clearCookie("adminToken", getCookieOptions());
        res.clearCookie("token", getCookieOptions());
    }
    next();
};

export const preventCache = preventAdminCache;
