import express from "express";
import { showHome } from "../../controllers/user/home.controller.js";
import { optionalAuth } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", optionalAuth, showHome);
router.get("/collections", optionalAuth, showHome);

export default router;
