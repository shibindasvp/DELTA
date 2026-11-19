import { getDashboardStats } from "../../services/admin/dashboard.service.js";

export const showDashboard = async (req, res, next) => {
    try {
        const timeframe = req.query.timeframe === "7d" ? "7d" : "30d";
        const stats = await getDashboardStats(timeframe);

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({ success: true, stats });
        }

        res.render("admin/dashboard/index", {
            stats,
            admin: req.admin || res.locals?.currentAdmin
        });
    } catch (error) {
        next(error);
    }
};
