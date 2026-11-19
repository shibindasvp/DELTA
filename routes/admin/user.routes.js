import express from "express";

import {
    showUsers,
    showUserDetails,
    blockUserHandler,
    unblockUserHandler,
    exportUsersHandler
} from "../../controllers/admin/user.controller.js";

import { isAdminAuthenticated } from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();

router.get("/users/export", isAdminAuthenticated, exportUsersHandler);
router.get("/clients/export", isAdminAuthenticated, exportUsersHandler);
router.get("/users", isAdminAuthenticated, showUsers);
router.get("/clients", isAdminAuthenticated, showUsers);
router.get("/users/:id", isAdminAuthenticated, showUserDetails);
router.get("/clients/:id", isAdminAuthenticated, showUserDetails);
router.post("/users/:id/block", isAdminAuthenticated, blockUserHandler);
router.post("/clients/:id/block", isAdminAuthenticated, blockUserHandler);
router.post("/users/:id/unblock", isAdminAuthenticated, unblockUserHandler);
router.post("/clients/:id/unblock", isAdminAuthenticated, unblockUserHandler);

export default router;


