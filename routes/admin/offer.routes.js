import express from "express";
import {
    showOffers,
    getOfferDetailApi,
    createOfferHandler,
    updateOfferHandler,
    toggleOfferStatusHandler,
    deleteOfferHandler
} from "../../controllers/admin/offer.controller.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();


router.get("/offers", isAdminAuthenticated, showOffers);
router.get("/offers/:id", isAdminAuthenticated, getOfferDetailApi);

router.post("/offers", isAdminAuthenticated, createOfferHandler);
router.post("/offers/create", isAdminAuthenticated, createOfferHandler);

router.post("/offers/:id/edit", isAdminAuthenticated, updateOfferHandler);
router.put("/offers/:id", isAdminAuthenticated, updateOfferHandler);

router.post("/offers/:id/toggle", isAdminAuthenticated, toggleOfferStatusHandler);
router.patch("/offers/:id/toggle", isAdminAuthenticated, toggleOfferStatusHandler);

router.post("/offers/:id/delete", isAdminAuthenticated, deleteOfferHandler);
router.delete("/offers/:id", isAdminAuthenticated, deleteOfferHandler);

export default router;
