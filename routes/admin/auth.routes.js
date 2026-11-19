import express from "express";

import {
    showAdminLogin,
    adminLogin,
    adminLogout,
    showAdminForgotPassword,
    adminForgotPassword,
    showAdminResetPassword,
    adminResetPassword,
    adminResendOTP
} from "../../controllers/admin/auth.controller.js";

import { isAdminGuest } from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();

router.get("/login", isAdminGuest, showAdminLogin);
router.post("/login", isAdminGuest, adminLogin);

router.get("/forgot-password", isAdminGuest, showAdminForgotPassword);
router.post("/forgot-password", isAdminGuest, adminForgotPassword);

router.get("/reset-password", isAdminGuest, showAdminResetPassword);
router.post("/reset-password", isAdminGuest, adminResetPassword);
router.post("/resend-otp", isAdminGuest, adminResendOTP);

router.post("/logout", adminLogout);
router.get("/logout", adminLogout);

export default router;
