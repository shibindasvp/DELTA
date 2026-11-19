import express from "express";

import { showDashboard } from "../../controllers/admin/dashboard.controller.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();

router.get("/dashboard", isAdminAuthenticated, showDashboard);
router.get("/", isAdminAuthenticated, (req, res) => res.redirect("/admin/dashboard"));

export default router;
