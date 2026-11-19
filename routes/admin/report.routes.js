import express from "express";
import {
    showSalesReport,
    downloadSalesReportPdf,
    downloadSalesReportExcel
} from "../../controllers/admin/report.controller.js";
import { isAdminAuthenticated } from "../../middlewares/adminAuth.middleware.js";

const router = express.Router();

router.get("/reports", isAdminAuthenticated, showSalesReport);
router.get("/reports/download-pdf", isAdminAuthenticated, downloadSalesReportPdf);
router.get("/reports/download-excel", isAdminAuthenticated, downloadSalesReportExcel);


router.get("/sales-report", isAdminAuthenticated, (req, res) => res.redirect("/admin/reports"));

export default router;
