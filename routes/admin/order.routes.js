import express from "express";
import { 
    showOrders, 
    showOrderDetailAdmin, 
    updateOrderStatusHandler, 
    updateOrderItemStatusHandler,
    downloadAdminOrderInvoiceHandler,
    showReturns,
    approveReturnHandler,
    declineReturnHandler,
    approveItemReturnHandler,
    declineItemReturnHandler
} from "../../controllers/admin/order.controller.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();


router.get("/orders", isAdminAuthenticated, showOrders);
router.get("/orders/:id", isAdminAuthenticated, showOrderDetailAdmin);
router.post("/orders/:id/status", isAdminAuthenticated, updateOrderStatusHandler);
router.post("/orders/:id/items/:itemId/status", isAdminAuthenticated, updateOrderItemStatusHandler);
router.get("/orders/:id/invoice", isAdminAuthenticated, downloadAdminOrderInvoiceHandler);


router.get("/returns", isAdminAuthenticated, showReturns);
router.post("/orders/:id/return/approve", isAdminAuthenticated, approveReturnHandler);
router.post("/orders/:id/return/decline", isAdminAuthenticated, declineReturnHandler);
router.post("/orders/:id/items/:itemId/return/approve", isAdminAuthenticated, approveItemReturnHandler);
router.post("/orders/:id/items/:itemId/return/decline", isAdminAuthenticated, declineItemReturnHandler);

export default router;

