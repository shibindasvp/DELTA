import express from "express";
import {
    showReviews,
    getReviewDetailApi,
    toggleReviewStatusHandler,
    deleteReviewHandler
} from "../../controllers/admin/review.controller.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();

router.get("/reviews", isAdminAuthenticated, showReviews);
router.get("/reviews/:id", isAdminAuthenticated, getReviewDetailApi);

router.post("/reviews/:id/toggle", isAdminAuthenticated, toggleReviewStatusHandler);
router.patch("/reviews/:id/toggle", isAdminAuthenticated, toggleReviewStatusHandler);

router.post("/reviews/:id/delete", isAdminAuthenticated, deleteReviewHandler);
router.delete("/reviews/:id", isAdminAuthenticated, deleteReviewHandler);

export default router;
