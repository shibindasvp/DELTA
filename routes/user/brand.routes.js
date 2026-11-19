import express from "express";
import { showUserBrands } from "../../controllers/user/brand.controller.js";
import { optionalAuth } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/brands", optionalAuth, showUserBrands);
router.get("/collections", optionalAuth, showUserBrands);

export default router;
