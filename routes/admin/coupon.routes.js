import express from "express";
import {
    showCoupons,
    getCouponDetailApi,
    createCouponHandler,
    updateCouponHandler,
    toggleCouponStatusHandler,
    deleteCouponHandler
} from "../../controllers/admin/coupon.controller.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();

// List & Detail
router.get("/coupons", isAdminAuthenticated, showCoupons);
router.get("/coupons/add", isAdminAuthenticated, (req, res) => res.redirect("/admin/coupons?action=create"));
router.get("/coupons/create", isAdminAuthenticated, (req, res) => res.redirect("/admin/coupons?action=create"));
router.get("/coupons/:id", isAdminAuthenticated, getCouponDetailApi);

// Create
router.post("/coupons", isAdminAuthenticated, createCouponHandler);
router.post("/coupons/create", isAdminAuthenticated, createCouponHandler);

// Update
router.post("/coupons/:id/edit", isAdminAuthenticated, updateCouponHandler);
router.put("/coupons/:id", isAdminAuthenticated, updateCouponHandler);

// Toggle Active/Inactive Status
router.post("/coupons/:id/toggle", isAdminAuthenticated, toggleCouponStatusHandler);
router.patch("/coupons/:id/toggle", isAdminAuthenticated, toggleCouponStatusHandler);

// Delete / Archive
router.post("/coupons/:id/delete", isAdminAuthenticated, deleteCouponHandler);
router.delete("/coupons/:id", isAdminAuthenticated, deleteCouponHandler);

export default router;
