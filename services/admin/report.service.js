import Order from "../../models/order.model.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

export const formatDateKey = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};


export const resolveDateRange = (period = "monthly", customStart = null, customEnd = null) => {
    let end = new Date();
    if (customEnd && typeof customEnd === "string" && customEnd.includes("-")) {
        const [ey, em, ed] = customEnd.split("-").map(Number);
        end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    } else if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
    } else {
        end.setHours(23, 59, 59, 999);
    }

    let start = new Date();

    switch (period) {
        case "daily":
            start.setHours(0, 0, 0, 0);
            break;
        case "weekly":
            start.setDate(end.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            break;
        case "monthly":
            start.setDate(end.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            break;
        case "yearly":
            start.setFullYear(end.getFullYear() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        case "custom":
            if (customStart && typeof customStart === "string" && customStart.includes("-")) {
                const [sy, sm, sd] = customStart.split("-").map(Number);
                start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
            } else if (customStart) {
                start = new Date(customStart);
                start.setHours(0, 0, 0, 0);
            } else {
                start.setDate(end.getDate() - 30);
                start.setHours(0, 0, 0, 0);
            }
            break;
        default:
            start.setDate(end.getDate() - 30);
            start.setHours(0, 0, 0, 0);
            period = "monthly";
    }

    return { start, end, period, startDate: formatDateKey(start), endDate: formatDateKey(end) };
};

export const PURCHASED_ORDER_FILTER = {
    $or: [
        { paymentStatus: "Completed" },
        { orderStatus: "Delivered" }
    ],
    orderStatus: { $nin: ["Cancelled", "Returned", "Return Requested"] },
    paymentStatus: { $nin: ["Failed", "Refunded"] }
};


export const getSalesReportData = async ({
    period = "monthly",
    startDate = null,
    endDate = null,
    page = 1,
    limit = 10,
    status = "all",
    paymentMethod = "all"
}) => {
    const { start, end, period: resolvedPeriod } = resolveDateRange(period, startDate, endDate);

    const query = {
        ...PURCHASED_ORDER_FILTER,
        createdAt: { $gte: start, $lte: end }
    };

    if (status && status !== "all") {
        query.orderStatus = status;
    }

    if (paymentMethod && paymentMethod !== "all") {
        query.paymentMethod = paymentMethod;
    }

    const metricsAgg = await Order.aggregate([
        { $match: query },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalGrossAmount: { $sum: { $ifNull: ["$originalSubtotal", "$subtotal"] } },
                totalDiscount: { $sum: "$discountAmount" },
                totalCouponDiscount: { $sum: "$discountAmount" },
                totalNetRevenue: { $sum: "$grandTotal" },
                totalCouponsCount: {
                    $sum: {
                        $cond: [
                            {
                                $or: [
                                    { $and: [{ $ne: ["$appliedCoupon.code", ""] }, { $ne: ["$appliedCoupon.code", null] }] },
                                    { $gt: [{ $size: { $ifNull: ["$appliedCoupons", []] } }, 0] },
                                    { $gt: ["$discountAmount", 0] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const summary = metricsAgg.length > 0 ? metricsAgg[0] : {
        totalOrders: 0,
        totalGrossAmount: 0,
        totalDiscount: 0,
        totalCouponDiscount: 0,
        totalNetRevenue: 0,
        totalCouponsCount: 0
    };
    summary.totalCouponDiscount = Number(summary.totalCouponDiscount || summary.totalDiscount || 0);

    const paymentMethodsAgg = await Order.aggregate([
        { $match: query },
        {
            $group: {
                _id: "$paymentMethod",
                count: { $sum: 1 },
                revenue: { $sum: "$grandTotal" }
            }
        }
    ]);

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (currentPage - 1) * pageLimit;

    const totalOrdersCount = summary.totalOrders || 0;
    const totalPages = Math.ceil(totalOrdersCount / pageLimit) || 1;

    const orders = await Order.find(query)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean();

    return {
        period: resolvedPeriod,
        startDate: formatDateKey(start),
        endDate: formatDateKey(end),
        status,
        paymentMethod,
        summary,
        paymentMethods: paymentMethodsAgg,
        orders,
        pagination: {
            currentPage,
            totalPages,
            totalOrders: totalOrdersCount,
            limit: pageLimit,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1
        }
    };
};


export const generateSalesReportPdfStream = async ({ period, startDate, endDate, status, paymentMethod }) => {
    const data = await getSalesReportData({
        period,
        startDate,
        endDate,
        page: 1,
        limit: 5000,
        status,
        paymentMethod
    });

    const doc = new PDFDocument({ margin: 36, size: "A4" });


    const primaryColor = "#0A4D2E";
    const goldColor = "#c5a059";
    const darkColor = "#18181b";
    const mutedColor = "#71717a";

    doc.rect(36, 36, 523, 70).fill(primaryColor);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18).text("DELTA HAUTE HORLOGERIE", 50, 48);
    doc.fillColor(goldColor).font("Helvetica").fontSize(9).text("EXECUTIVE SALES ANALYTICS & PURCHASES LEDGER", 50, 70);
    doc.fillColor("#ffffff").font("Helvetica").fontSize(8).text(
        `Generated: ${new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
        360,
        70,
        { width: 185, align: "right" }
    );

    let y = 120;
    doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(11).text("REPORT PARAMETERS", 36, y);
    y += 16;
    doc.rect(36, y, 523, 30).fill("#f4f4f5");
    doc.fillColor(darkColor).font("Helvetica").fontSize(8).text(
        `Scope: Verified Purchases Only   •   Period: ${period.toUpperCase()}   •   Date Range: ${data.startDate} to ${data.endDate}   •   Filter: ${status} | ${paymentMethod}`,
        46,
        y + 10
    );

    y += 42;
    const cardW = 166;
    const cardH = 46;
    const metrics = [
        { label: "TOTAL PURCHASES", val: `${data.summary.totalOrders} Orders` },
        { label: "TOTAL COUPON DISCOUNTS", val: `-₹${Number(data.summary.totalCouponDiscount || data.summary.totalDiscount || 0).toLocaleString("en-IN")}` },
        { label: "NET SETTLED REVENUE", val: `₹${Number(data.summary.totalNetRevenue || 0).toLocaleString("en-IN")}` }
    ];

    metrics.forEach((m, idx) => {
        const cx = 36 + idx * (cardW + 12.5);
        doc.rect(cx, y, cardW, cardH).lineWidth(0.8).strokeColor("#e4e4e7").fillAndStroke("#ffffff", "#e4e4e7");
        doc.fillColor(mutedColor).font("Helvetica-Bold").fontSize(7).text(m.label, cx + 8, y + 8, { width: cardW - 16 });
        doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(10).text(m.val, cx + 8, y + 24, { width: cardW - 16 });
    });

    y += 58;
    doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(10).text("TRANSACTION LEDGER", 36, y);
    y += 16;

    const tableX = 36;
    const cols = [
        { label: "DATE", width: 50 },
        { label: "ORDER ID", width: 72 },
        { label: "COLLECTOR", width: 85 },
        { label: "TIMEPIECE(S)", width: 95 },
        { label: "PAYMENT", width: 50 },
        { label: "COUPON DISC", width: 62 },
        { label: "NET AMOUNT", width: 61 },
        { label: "STATUS", width: 48 }
    ];

    doc.rect(tableX, y, 523, 20).fill(primaryColor);
    let curX = tableX + 4;
    cols.forEach(c => {
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7).text(c.label, curX, y + 6, {
            width: c.width - 4,
            align: (c.label === "NET AMOUNT" || c.label === "COUPON DISC") ? "right" : (c.label === "STATUS" ? "center" : "left")
        });
        curX += c.width;
    });

    y += 20;

    data.orders.forEach((ord, index) => {
        if (y > 750) {
            doc.addPage();
            y = 40;
            doc.rect(tableX, y, 523, 20).fill(primaryColor);
            let rx = tableX + 4;
            cols.forEach(c => {
                doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7).text(c.label, rx, y + 6, {
                    width: c.width - 4,
                    align: (c.label === "NET AMOUNT" || c.label === "COUPON DISC") ? "right" : (c.label === "STATUS" ? "center" : "left")
                });
                rx += c.width;
            });
            y += 20;
        }

        const bg = index % 2 === 0 ? "#ffffff" : "#fbfbfb";
        doc.rect(tableX, y, 523, 20).fill(bg);

        const dateStr = new Date(ord.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        const itemsSummary = (ord.items || []).map(i => `${i.productName} (x${i.quantity})`).join(", ");

        let rx = tableX + 4;
        doc.fillColor(darkColor).font("Helvetica").fontSize(7);

        doc.text(dateStr, rx, y + 6, { width: cols[0].width - 4 });
        rx += cols[0].width;

        doc.font("Helvetica-Bold").text(ord.orderNumber || "", rx, y + 6, { width: cols[1].width - 4 });
        rx += cols[1].width;

        doc.font("Helvetica").text(ord.collectorName || ord.user?.name || "Client", rx, y + 6, { width: cols[2].width - 4, lineBreak: false });
        rx += cols[2].width;

        doc.text(itemsSummary, rx, y + 6, { width: cols[3].width - 4, lineBreak: false });
        rx += cols[3].width;

        doc.text(ord.paymentMethod || "COD", rx, y + 6, { width: cols[4].width - 4 });
        rx += cols[4].width;

        const couponDisc = Number(ord.discountAmount || 0);
        if (couponDisc > 0) {
            doc.font("Helvetica-Bold").fillColor("#b91c1c").text(`-₹${couponDisc.toLocaleString("en-IN")}`, rx, y + 6, { width: cols[5].width - 4, align: "right" });
        } else {
            doc.font("Helvetica").fillColor(mutedColor).text("₹0", rx, y + 6, { width: cols[5].width - 4, align: "right" });
        }
        rx += cols[5].width;

        doc.fillColor(darkColor).font("Helvetica-Bold").text(`₹${Number(ord.grandTotal || 0).toLocaleString("en-IN")}`, rx, y + 6, { width: cols[6].width - 4, align: "right" });
        rx += cols[6].width;

        const st = ord.orderStatus || "Pending";
        doc.font("Helvetica").fillColor(st === "Delivered" ? "#0A4D2E" : st === "Cancelled" ? "#b91c1c" : "#b45309").text(st, rx, y + 6, { width: cols[7].width - 4, align: "center" });

        y += 20;
    });

    y += 5;
    doc.rect(tableX, y, 523, 22).fill("#f4f4f5");
    doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(7.5).text(
        `TOTAL COUPON DISCOUNTS: -₹${Number(data.summary.totalCouponDiscount || data.summary.totalDiscount || 0).toLocaleString("en-IN")}`,
        tableX + 8,
        y + 7
    );
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(8.5).text(
        `TOTAL NET REVENUE: ₹${Number(data.summary.totalNetRevenue || 0).toLocaleString("en-IN")}`,
        tableX + 260,
        y + 7,
        { width: 255, align: "right" }
    );

    return doc;
};


export const generateSalesReportExcelWorkbook = async ({ period, startDate, endDate, status, paymentMethod }) => {
    const data = await getSalesReportData({
        period,
        startDate,
        endDate,
        page: 1,
        limit: 10000,
        status,
        paymentMethod
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "DELTA Horology";
    workbook.created = new Date();


    const summarySheet = workbook.addWorksheet("Executive Summary", {
        views: [{ showGridLines: true }]
    });

    summarySheet.columns = [
        { header: "Metric / Parameter", key: "param", width: 35 },
        { header: "Value", key: "val", width: 35 }
    ];

    summarySheet.addRow(["DELTA HAUTE HORLOGERIE - SALES REPORT (PURCHASED ONLY)", ""]);
    summarySheet.addRow(["Report Scope", "Verified Purchased Orders Only (Excludes Cancelled, Returned, and Failed)"]);
    summarySheet.addRow(["Report Period", period.toUpperCase()]);
    summarySheet.addRow(["Date From", data.startDate]);
    summarySheet.addRow(["Date To", data.endDate]);
    summarySheet.addRow(["Status Filter", status.toUpperCase()]);
    summarySheet.addRow(["Payment Gateway Filter", paymentMethod.toUpperCase()]);
    summarySheet.addRow(["Generated At", new Date().toLocaleString("en-IN")]);
    summarySheet.addRow(["", ""]);
    summarySheet.addRow(["EXECUTIVE KEY PERFORMANCE INDICATORS", ""]);
    summarySheet.addRow(["Total Purchased Orders", data.summary.totalOrders]);
    summarySheet.addRow(["Gross Sales Valuation", Number(data.summary.totalGrossAmount || 0)]);
    summarySheet.addRow(["Total Coupon Discounts Deducted", Number(data.summary.totalCouponDiscount || data.summary.totalDiscount || 0)]);
    summarySheet.addRow(["Coupons Redeemed Count", data.summary.totalCouponsCount || 0]);
    summarySheet.addRow(["Net Realized Revenue", Number(data.summary.totalNetRevenue || 0)]);

    summarySheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF0A4D2E" } };
    summarySheet.getRow(10).font = { bold: true, size: 12, color: { argb: "FF0A4D2E" } };

    [12, 13, 15].forEach(rowNum => {
        const cell = summarySheet.getCell(`B${rowNum}`);
        cell.numFmt = "₹#,##0.00";
    });


    const ledgerSheet = workbook.addWorksheet("Transaction Ledger", {
        views: [{ showGridLines: true }]
    });

    ledgerSheet.columns = [
        { header: "Order ID", key: "orderNumber", width: 22 },
        { header: "Date & Time", key: "date", width: 22 },
        { header: "Collector Name", key: "collectorName", width: 25 },
        { header: "Collector Email", key: "collectorEmail", width: 28 },
        { header: "Timepieces / Items", key: "items", width: 35 },
        { header: "Payment Method", key: "paymentMethod", width: 18 },
        { header: "Payment Status", key: "paymentStatus", width: 16 },
        { header: "Gross Amount (₹)", key: "gross", width: 18 },
        { header: "Coupon Code", key: "couponCode", width: 18 },
        { header: "Coupon Discount (₹)", key: "couponDiscount", width: 20 },
        { header: "Net Amount Paid (₹)", key: "net", width: 20 },
        { header: "Order Status", key: "orderStatus", width: 16 }
    ];

    const headerRow = ledgerSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0A4D2E" }
    };

    data.orders.forEach(ord => {
        const itemsStr = (ord.items || []).map(i => `${i.productName} (x${i.quantity})`).join(", ");
        const gross = ord.originalSubtotal || (ord.subtotal + (ord.discountAmount || 0));
        const couponCode = (ord.appliedCoupons && ord.appliedCoupons.length > 0)
            ? ord.appliedCoupons.map(c => c.code).filter(Boolean).join(", ")
            : (ord.appliedCoupon?.code || "None");

        ledgerSheet.addRow({
            orderNumber: ord.orderNumber,
            date: new Date(ord.createdAt).toLocaleString("en-IN"),
            collectorName: ord.collectorName || ord.user?.name || "Private Client",
            collectorEmail: ord.collectorEmail || ord.user?.email || "N/A",
            items: itemsStr,
            paymentMethod: ord.paymentMethod || "COD",
            paymentStatus: ord.paymentStatus || "Pending",
            gross: Number(gross || 0),
            couponCode: couponCode,
            couponDiscount: Number(ord.discountAmount || 0),
            net: Number(ord.grandTotal || 0),
            orderStatus: ord.orderStatus || "Pending"
        });
    });

    ledgerSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.getCell(8).numFmt = "₹#,##0.00";
            row.getCell(10).numFmt = "₹#,##0.00";
            row.getCell(11).numFmt = "₹#,##0.00";
        }
    });

    return workbook;
};
