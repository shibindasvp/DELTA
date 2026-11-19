import {
    getUsersList,
    blockUser,
    unblockUser,
    getUserDetails,
    exportUsersCsv
} from "../../services/admin/user.service.js";
import User from "../../models/user.model.js";
import { isAjaxRequest, normalizeError } from "../../utils/error.js";

export const showUsers = async (req, res, next) => {

    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const [{ users, pagination }, totalUsers, activeUsers, blockedUsers, verifiedUsers] = await Promise.all([
            getUsersList({ search, page, limit }),
            User.countDocuments(),
            User.countDocuments({ isBlocked: false }),
            User.countDocuments({ isBlocked: true }),
            User.countDocuments({ isVerified: true })
        ]);

        const stats = {
            totalUsers,
            activeUsers,
            blockedUsers,
            verifiedUsers
        };

        if (req.xhr || req.headers.accept?.includes("json") || req.query.ajax === "true") {
            return res.json({
                success: true,
                users,
                pagination,
                search,
                stats
            });
        }

        const flashSuccess = req.query.blocked === "true"
            ? "User has been blocked successfully."
            : req.query.unblocked === "true"
            ? "User has been unblocked successfully."
            : null;

        const flashError = req.query.error || null;

        res.render("admin/users/index", {
            users,
            pagination,
            search,
            stats,
            success: flashSuccess,
            error: flashError,
            admin: req.admin || res.locals.currentAdmin
        });
    } catch (error) {
        if (isAjaxRequest(req)) {
            const { statusCode, message } = normalizeError(error, "Unable to load users list.");
            return res.status(statusCode).json({ success: false, message });
        }
        next(error);
    }
};

export const showUserDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await getUserDetails(id);

        const flashSuccess = req.query.blocked === "true"
            ? "Collector account has been blocked."
            : req.query.unblocked === "true"
            ? "Collector account has been unblocked."
            : null;

        res.render("admin/users/show", {
            user,
            success: flashSuccess,
            error: req.query.error || null,
            admin: req.admin || res.locals.currentAdmin
        });
    } catch (error) {
        next(error);
    }
};

export const blockUserHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        await blockUser(id);

        if (req.xhr || req.headers.accept?.includes("json")) {
            const [totalUsers, activeUsers, blockedUsers, verifiedUsers] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ isBlocked: false }),
                User.countDocuments({ isBlocked: true }),
                User.countDocuments({ isVerified: true })
            ]);
            return res.json({
                success: true,
                isBlocked: true,
                message: "Collector account has been restricted.",
                stats: { totalUsers, activeUsers, blockedUsers, verifiedUsers }
            });
        }

        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        const redirectUrl = req.query.redirect === "detail"
            ? `/admin/users/${id}?blocked=true`
            : `/admin/users?blocked=true&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`;

        res.redirect(redirectUrl);
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Failed to restrict user account.", 400);
        if (isAjaxRequest(req)) {
            return res.status(statusCode).json({ success: false, message });
        }
        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        res.redirect(`/admin/users?error=${encodeURIComponent(message)}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
    }
};

export const unblockUserHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        await unblockUser(id);

        if (req.xhr || req.headers.accept?.includes("json")) {
            const [totalUsers, activeUsers, blockedUsers, verifiedUsers] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ isBlocked: false }),
                User.countDocuments({ isBlocked: true }),
                User.countDocuments({ isVerified: true })
            ]);
            return res.json({
                success: true,
                isBlocked: false,
                message: "Collector account has been restored to active status.",
                stats: { totalUsers, activeUsers, blockedUsers, verifiedUsers }
            });
        }

        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        const redirectUrl = req.query.redirect === "detail"
            ? `/admin/users/${id}?unblocked=true`
            : `/admin/users?unblocked=true&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`;

        res.redirect(redirectUrl);
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Failed to unblock user account.", 400);
        if (isAjaxRequest(req)) {
            return res.status(statusCode).json({ success: false, message });
        }
        const search = req.query.search || "";
        const page = req.query.page || 1;
        res.redirect(`/admin/users?error=${encodeURIComponent(message)}&search=${encodeURIComponent(search)}&page=${page}`);
    }
};

export const exportUsersHandler = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const csvContent = await exportUsersCsv({ search });
        const dateStr = new Date().toISOString().split("T")[0];
        const filename = `delta-collector-registry-${dateStr}.csv`;

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(csvContent);
    } catch (error) {
        next(error);
    }
};
