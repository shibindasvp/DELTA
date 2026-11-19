import {
    getSalesReportData,
    generateSalesReportPdfStream,
    generateSalesReportExcelWorkbook
} from "../../services/admin/report.service.js";


export const showSalesReport = async (req, res, next) => {
    try {
        const {
            period = "monthly",
            startDate,
            endDate,
            page = 1,
            limit = 10,
            status = "all",
            paymentMethod = "all"
        } = req.query;

        const reportData = await getSalesReportData({
            period,
            startDate,
            endDate,
            page,
            limit,
            status,
            paymentMethod
        });

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({ success: true, ...reportData });
        }

        res.render("admin/reports/index", {
            ...reportData,
            admin: req.admin || res.locals.currentAdmin,
            activePage: "reports"
        });
    } catch (error) {
        next(error);
    }
};


export const downloadSalesReportPdf = async (req, res, next) => {
    try {
        const {
            period = "monthly",
            startDate,
            endDate,
            status = "all",
            paymentMethod = "all"
        } = req.query;

        const pdfDoc = await generateSalesReportPdfStream({
            period,
            startDate,
            endDate,
            status,
            paymentMethod
        });

        const filename = `DELTA-Sales-Report-${new Date().toISOString().split("T")[0]}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        pdfDoc.pipe(res);
        pdfDoc.end();
    } catch (error) {
        next(error);
    }
};


export const downloadSalesReportExcel = async (req, res, next) => {
    try {
        const {
            period = "monthly",
            startDate,
            endDate,
            status = "all",
            paymentMethod = "all"
        } = req.query;

        const workbook = await generateSalesReportExcelWorkbook({
            period,
            startDate,
            endDate,
            status,
            paymentMethod
        });

        const filename = `DELTA-Sales-Report-${new Date().toISOString().split("T")[0]}.xlsx`;

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        next(error);
    }
};
