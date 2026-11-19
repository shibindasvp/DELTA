import express from "express";
import {
    showInventory,
    updateStockHandler,
    bulkUpdateStockHandler,
    exportInventoryCSV
} from "../../controllers/admin/inventory.controller.js";
import {
    isAdminAuthenticated,
    preventAdminCache
} from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();


router.get(
    "/inventory",
    isAdminAuthenticated,
    preventAdminCache,
    showInventory
);


router.post(
    "/inventory/update-stock",
    isAdminAuthenticated,
    updateStockHandler
);


router.post(
    "/inventory/:productId/update-stock",
    isAdminAuthenticated,
    updateStockHandler
);


router.post(
    "/inventory/bulk-update",
    isAdminAuthenticated,
    bulkUpdateStockHandler
);


router.get(
    "/inventory/export",
    isAdminAuthenticated,
    exportInventoryCSV
);

export default router;
