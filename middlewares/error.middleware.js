import { isAjaxRequest, normalizeError } from "../utils/error.js";

const STATUS_TITLES = {
    400: "Invalid Request",
    401: "Authentication Required",
    403: "Access Restricted",
    404: "Resource Not Found",
    409: "Duplicate Entry",
    413: "Payload Too Large",
    429: "Too Many Requests",
    500: "Unable to Process Request",
    503: "Service Temporarily Unavailable"
};

export const notFoundHandler = (req, res, next) => {
    const isAdmin = Boolean(req.originalUrl?.startsWith("/admin"));
    const message = isAdmin
        ? `The admin page "${req.originalUrl}" could not be found.`
        : `The page "${req.originalUrl}" does not exist or may have been moved.`;

    if (isAjaxRequest(req)) {
        return res.status(404).json({
            success: false,
            message
        });
    }

    return res.status(404).render("errors/404", {
        statusCode: 404,
        title: "Page Not Found",
        url: req.originalUrl,
        isAdmin,
        message,
        user: req.user || res.locals?.currentUser || null
    });
};

export const errorHandler = (err, req, res, next) => {
    console.error(`[Error Handler] ${req.method} ${req.originalUrl}:`, err);

    if (res.headersSent) {
        return next(err);
    }

    const { statusCode, message, errors } = normalizeError(
        err,
        "We encountered an unexpected issue while processing your request. Please try again."
    );

    if (isAjaxRequest(req)) {
        const payload = {
            success: false,
            message
        };
        if (errors) {
            payload.errors = errors;
        }
        return res.status(statusCode).json(payload);
    }

    const isAdmin = Boolean(req.originalUrl?.startsWith("/admin"));
    const viewName = statusCode === 404 ? "errors/404" : "errors/500";
    const title = STATUS_TITLES[statusCode] || STATUS_TITLES[500];

    return res.status(statusCode).render(viewName, {
        statusCode,
        title,
        message,
        errors,
        error: process.env.NODE_ENV === "development" ? (err.stack || message) : null,
        url: req.originalUrl,
        isAdmin,
        user: req.user || res.locals?.currentUser || null
    });
};
