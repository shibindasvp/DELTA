import PDFDocument from "pdfkit";

const PAGE = {
    left: 35,
    right: 558,
    width: 523,
    top: 35,
    maxContentY: 775
};

const TABLE_COLS = {
    item: { x: 42, w: 184, align: "left" },
    qty: { x: 230, w: 22, align: "center" },
    unit: { x: 256, w: 50, align: "right" },
    offer: { x: 310, w: 42, align: "right" },
    coupon: { x: 356, w: 42, align: "right" },
    taxable: { x: 402, w: 48, align: "right" },
    gst: { x: 454, w: 44, align: "right" },
    lineTotal: { x: 502, w: 52, align: "right" }
};

function drawWrappedLine(doc, text, x, y, width, opts = {}, gap = 2.5) {
    doc.text(text, x, y, { width, ...opts });
    return y + doc.heightOfString(text, { width, ...opts }) + gap;
}

function drawFittedCellText(doc, text, col, y, baseSize = 7.5, minSize = 6) {
    let size = baseSize;
    doc.fontSize(size);
    while (size > minSize && doc.widthOfString(text) > col.w) {
        size -= 0.5;
        doc.fontSize(size);
    }
    doc.text(text, col.x, y, { width: col.w, align: col.align });
}

function drawTableHeader(doc, tableTop, borderColor, darkColor) {
    const tableHeaderHeight = 22;
    doc.rect(PAGE.left, tableTop, PAGE.width, tableHeaderHeight).fillColor("#f1f5f9").fill();
    doc.rect(PAGE.left, tableTop, PAGE.width, tableHeaderHeight).strokeColor(borderColor).lineWidth(0.5).stroke();

    const headerY = tableTop + 7;
    doc.fontSize(7.5).fillColor(darkColor).font("Helvetica-Bold");
    doc.text("Item / Variant Details & Status", TABLE_COLS.item.x, headerY, { width: TABLE_COLS.item.w, align: "left" });
    doc.text("Qty", TABLE_COLS.qty.x, headerY, { width: TABLE_COLS.qty.w, align: "center" });
    doc.text("Unit Price", TABLE_COLS.unit.x, headerY, { width: TABLE_COLS.unit.w, align: "right" });
    doc.text("Offer Disc", TABLE_COLS.offer.x, headerY, { width: TABLE_COLS.offer.w, align: "right" });
    doc.text("Coupon", TABLE_COLS.coupon.x, headerY, { width: TABLE_COLS.coupon.w, align: "right" });
    doc.text("Taxable", TABLE_COLS.taxable.x, headerY, { width: TABLE_COLS.taxable.w, align: "right" });
    doc.text("GST (18%)", TABLE_COLS.gst.x, headerY, { width: TABLE_COLS.gst.w, align: "right" });
    doc.text("Line Total", TABLE_COLS.lineTotal.x, headerY, { width: TABLE_COLS.lineTotal.w, align: "right" });

    return tableTop + tableHeaderHeight + 8;
}

export const generateOrderInvoicePdf = (order, res) => {
    const doc = new PDFDocument({ margin: 35, size: "A4" });

    const filename = `DELTA-Invoice-${order.orderNumber}.pdf`;
    if (typeof res.setHeader === "function") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    }

    doc.pipe(res);

    // Color Palette
    const primaryColor = "#0A4D2E"; // DELTA British Racing Green
    const darkColor = "#18181b";    // Onyx / Slate 900
    const mutedColor = "#64748b";   // Slate 500
    const goldColor = "#c5a059";    // Swiss Horology Gold
    const successColor = "#16a34a";// Green for discounts & refunds
    const dangerColor = "#dc2626";  // Red for cancellations / returns
    const borderColor = "#e2e8f0";  // Light border for tables and cards

    doc.fontSize(20).fillColor(darkColor).font("Helvetica-Bold").text("DELTA", PAGE.left, 28, { width: 255, letterSpacing: 3 });
    doc.fontSize(7).fillColor(goldColor).font("Helvetica-Bold").text("HAUTE HORLOGERIE & VAULT ALLOCATIONS", PAGE.left, 50, { width: 255, letterSpacing: 1.2 });
    doc.fontSize(7).fillColor(mutedColor).font("Helvetica").text("Geneva • Zurich • Mumbai • London • New York", PAGE.left, 60, { width: 255 });

    doc.fontSize(13).fillColor(primaryColor).font("Helvetica-Bold").text("OFFICIAL TAX INVOICE", 310, 28, { width: 248, align: "right" });
    doc.fontSize(8.5).fillColor(darkColor).font("Helvetica-Bold").text(`Order #: ${order.orderNumber}`, 310, 45, { width: 248, align: "right" });

    const orderDateStr = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
        : new Date().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
    doc.fontSize(7.5).fillColor(mutedColor).font("Helvetica").text(`Invoice Date: ${orderDateStr}`, 310, 58, { width: 248, align: "right" });

    doc.moveTo(PAGE.left, 74).lineTo(PAGE.right, 74).strokeColor(borderColor).lineWidth(1).stroke();

    const addr = order.shippingAddress || {};
    const headerTop = 82;
    const leftColWidth = 255;
    const rightColX = 310;
    const rightColWidth = 248;

    let leftY = headerTop;
    doc.fontSize(9.5).fillColor(darkColor).font("Helvetica-Bold");
    leftY = drawWrappedLine(doc, "Billed & Shipped To:", PAGE.left, leftY, leftColWidth, {}, 2);

    const collectorName = order.collectorName || addr.fullName || (order.user && order.user.name) || "Valued Collector";
    doc.fontSize(8.5).fillColor(darkColor).font("Helvetica-Bold");
    leftY = drawWrappedLine(doc, collectorName, PAGE.left, leftY, leftColWidth, {}, 2);

    const streetLine = addr.street || addr.addressLine1 || "";
    if (streetLine) {
        doc.fontSize(8).fillColor(mutedColor).font("Helvetica");
        leftY = drawWrappedLine(doc, streetLine, PAGE.left, leftY, leftColWidth, {}, 2);
    }
    const cityStateZip = [addr.city, addr.state, addr.postalCode || addr.pincode].filter(Boolean).join(", ");
    if (cityStateZip) {
        doc.fontSize(8).fillColor(mutedColor).font("Helvetica");
        leftY = drawWrappedLine(doc, cityStateZip, PAGE.left, leftY, leftColWidth, {}, 2);
    }
    const phone = addr.mobile || addr.phone || (order.user && order.user.phone);
    if (phone) {
        doc.fontSize(8).fillColor(mutedColor).font("Helvetica");
        leftY = drawWrappedLine(doc, `Phone: ${phone}`, PAGE.left, leftY, leftColWidth, {}, 2);
    }

    let rightY = headerTop;
    doc.fontSize(9.5).fillColor(darkColor).font("Helvetica-Bold");
    rightY = drawWrappedLine(doc, "Order Info:", rightColX, rightY, rightColWidth, {}, 2);

    let paymentMethodDisplay = order.paymentMethod || "Online Payment";
    if (paymentMethodDisplay === "Razorpay") paymentMethodDisplay = "Online Payment (Razorpay)";
    doc.fontSize(8).fillColor(mutedColor).font("Helvetica");
    rightY = drawWrappedLine(doc, `Payment Method: ${paymentMethodDisplay}`, rightColX, rightY, rightColWidth, {}, 2);

    const paymentStatusDisplay = (order.paymentStatus === "Completed" || order.paymentStatus === "Paid") ? "Paid" : (order.paymentStatus || "Pending");
    doc.fontSize(8).fillColor(mutedColor).font("Helvetica");
    rightY = drawWrappedLine(doc, `Payment Status: ${paymentStatusDisplay}`, rightColX, rightY, rightColWidth, {}, 2);

    let statusHeaderBadge = String(order.orderStatus || "Pending").toUpperCase();
    let statusHeaderColor = primaryColor;
    if (order.orderStatus === "Delivered") {
        statusHeaderBadge = "DELIVERED (PURCHASE COMPLETED)";
        statusHeaderColor = primaryColor;
    } else if (order.orderStatus === "Cancelled") {
        statusHeaderBadge = "CANCELLED (NOT PURCHASED)";
        statusHeaderColor = dangerColor;
    } else if (order.orderStatus === "Returned") {
        statusHeaderBadge = "REFUND PROCESSED (VAULT RESTOCKED)";
        statusHeaderColor = dangerColor;
    } else if (order.orderStatus === "Return Requested") {
        statusHeaderBadge = "RETURN REQUESTED (UNDER REVIEW)";
        statusHeaderColor = "#d97706";
    } else if (order.orderStatus === "Shipped") {
        statusHeaderBadge = "SHIPPED (IN TRANSIT - NOT DELIVERED)";
        statusHeaderColor = "#2563eb";
    } else if (order.orderStatus === "Out for Delivery") {
        statusHeaderBadge = "OUT FOR DELIVERY (PENDING DELIVERY)";
        statusHeaderColor = "#4f46e5";
    }

    doc.fontSize(8).fillColor(statusHeaderColor).font("Helvetica-Bold");
    rightY = drawWrappedLine(doc, `Order Status: ${statusHeaderBadge}`, rightColX, rightY, rightColWidth, {}, 2);

    const estDeliveryDate = order.createdAt
        ? new Date(new Date(order.createdAt).getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "5-7 Business Days";
    doc.fontSize(8).fillColor(mutedColor).font("Helvetica");
    rightY = drawWrappedLine(doc, `Est. Delivery: ${estDeliveryDate}`, rightColX, rightY, rightColWidth, {}, 2);

    const deliveredDateStr = order.deliveredAt
        ? new Date(order.deliveredAt).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
        : (order.orderStatus === "Delivered" ? orderDateStr : "Pending Delivery");
    doc.fontSize(8).fillColor(mutedColor).font("Helvetica");
    rightY = drawWrappedLine(doc, `Delivered Date: ${deliveredDateStr}`, rightColX, rightY, rightColWidth, {}, 2);

    const dividerY = Math.max(leftY, rightY) + 8;
    doc.moveTo(PAGE.left, dividerY).lineTo(PAGE.right, dividerY).strokeColor(borderColor).lineWidth(1).stroke();

    const allItems = order.items || [];
    const rawTotalCoupon = Number(order.originalDiscount) || Number(order.discountAmount) || 0;
    const originalSub = Number(order.originalSubtotal) || allItems.reduce((s, it) => s + (Number(it.itemTotal) || (Number(it.price) * (Number(it.quantity) || 1))), 0) || 1;

    let computedCouponAllocated = 0;
    const computedRows = allItems.map((item, idx) => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const itemGross = Number(item.itemTotal) || (Number(item.price) * qty);
        const unitPrice = Math.round(itemGross / qty);

        const offerDisc = Number(item.offerDiscount) || 0;

        let itemCoupon = 0;
        if (rawTotalCoupon > 0 && originalSub > 0) {
            if (item.refundAmount && item.refunded && Number(item.refundAmount) > 0) {
                itemCoupon = Math.max(0, (unitPrice * qty) - Number(item.refundAmount));
                computedCouponAllocated += itemCoupon;
            } else if (idx === allItems.length - 1) {
                itemCoupon = Math.max(0, rawTotalCoupon - computedCouponAllocated);
            } else {
                itemCoupon = Math.round((rawTotalCoupon * itemGross) / originalSub);
                computedCouponAllocated += itemCoupon;
            }
        }

        const taxable = Math.max(0, (unitPrice * qty) - offerDisc - itemCoupon);
        const gst = Math.round(taxable * 0.18);
        const lineTotal = taxable;

        return {
            item,
            qty,
            unitPrice,
            offerDisc,
            itemCoupon,
            taxable,
            gst,
            lineTotal
        };
    });

    const subtotalBeforeDiscounts = computedRows.reduce((sum, r) => sum + (r.unitPrice * r.qty), 0);
    const totalOfferDiscount = computedRows.reduce((sum, r) => sum + r.offerDisc, 0);
    const totalCouponDiscount = computedRows.reduce((sum, r) => sum + r.itemCoupon, 0);
    const taxableTotal = Math.max(0, subtotalBeforeDiscounts - totalOfferDiscount - totalCouponDiscount);
    const cgst = Math.round(taxableTotal * 0.09);
    const sgst = Math.round(taxableTotal * 0.09);
    const totalGst = cgst + sgst;
    const shippingFee = Number(order.shippingFee) || 0;
    const finalAmountPaid = taxableTotal + shippingFee;

    const inactiveRows = computedRows.filter(r => r.item.status === "Cancelled" || r.item.status === "Returned");
    const cancelledRows = computedRows.filter(r => r.item.status === "Cancelled");
    const returnedRows = computedRows.filter(r => r.item.status === "Returned");

    const calculatedCancelledDeduction = cancelledRows.reduce((sum, r) => sum + (r.unitPrice * r.qty), 0);
    const isPaidOrder = order.paymentStatus === "Completed" || order.paymentStatus === "Paid" || ["Razorpay", "PayPal", "Vault Card", "Wallet"].includes(order.paymentMethod);

    const refundableRows = isPaidOrder ? inactiveRows : returnedRows;
    const calculatedRefundSum = refundableRows.reduce((sum, r) => sum + r.lineTotal, 0);
    const refundedToWallet = (Number(order.refundAmount) > 0 && isPaidOrder)
        ? Number(order.refundAmount)
        : calculatedRefundSum;

    const purchasedRows = computedRows.filter(r => r.item.status !== "Cancelled" && r.item.status !== "Returned");
    const purchasedPrice = purchasedRows.reduce((sum, r) => sum + r.lineTotal, 0);

    let y = drawTableHeader(doc, dividerY + 10, borderColor, darkColor);

    computedRows.forEach((row) => {
        const { item, qty, unitPrice, offerDisc, itemCoupon, taxable, gst, lineTotal } = row;
        const itemStatus = item.status || order.orderStatus || "Pending";

        let statusBadge = "[Order Placed]";
        let statusBadgeColor = mutedColor;
        let purchaseStatusSubtext = "Pending Delivery";

        if (itemStatus === "Delivered") {
            statusBadge = "[Delivered]";
            statusBadgeColor = successColor;
            purchaseStatusSubtext = "Purchased & Received";
        } else if (itemStatus === "Cancelled") {
            statusBadge = "[Cancelled]";
            statusBadgeColor = dangerColor;
            purchaseStatusSubtext = "Not Purchased";
        } else if (itemStatus === "Returned") {
            statusBadge = "[Refund Processed]";
            statusBadgeColor = dangerColor;
            purchaseStatusSubtext = "Vault Restocked";
        } else if (itemStatus === "Return Requested") {
            statusBadge = "[Return Requested]";
            statusBadgeColor = "#d97706";
            purchaseStatusSubtext = "Under Review";
        } else if (itemStatus === "Shipped") {
            statusBadge = "[In Transit - Shipped]";
            statusBadgeColor = "#2563eb";
            purchaseStatusSubtext = "Not Yet Delivered";
        } else if (itemStatus === "Out for Delivery") {
            statusBadge = "[Out for Delivery]";
            statusBadgeColor = "#4f46e5";
            purchaseStatusSubtext = "Pending Delivery";
        }

        const variantParts = [];
        if (item.variant?.color) variantParts.push(`Color: ${item.variant.color}`);
        if (item.variant?.material) variantParts.push(`Material: ${item.variant.material}`);
        if (item.variant?.sku) variantParts.push(`SKU: ${item.variant.sku}`);
        const variantText = variantParts.length > 0 ? variantParts.join(" | ") : "Standard Vault Allocation";

        const titleText = `${item.brandName || "DELTA"} — ${item.productName}`;
        const statusText = `${statusBadge} ${purchaseStatusSubtext}`;

        doc.fontSize(8).font("Helvetica-Bold");
        const titleH = doc.heightOfString(titleText, { width: TABLE_COLS.item.w, lineGap: 1 });
        doc.fontSize(7).font("Helvetica");
        const variantH = doc.heightOfString(variantText, { width: TABLE_COLS.item.w, lineGap: 1.5 });
        doc.fontSize(7).font("Helvetica-Bold");
        const statusH = doc.heightOfString(statusText, { width: TABLE_COLS.item.w, lineGap: 1 });

        const itemBlockH = titleH + 2.5 + variantH + 3 + statusH;
        const rowContentHeight = Math.max(itemBlockH, 26);

        if (y + rowContentHeight + 14 > PAGE.maxContentY) {
            doc.addPage();
            y = drawTableHeader(doc, PAGE.top, borderColor, darkColor);
        }

        const cellY = y + 1;

        // Render Item Details sequentially to guarantee zero text overlap
        let textY = y;
        doc.fontSize(8).fillColor(darkColor).font("Helvetica-Bold").text(titleText, TABLE_COLS.item.x, textY, { width: TABLE_COLS.item.w, lineGap: 1 });
        textY += doc.heightOfString(titleText, { width: TABLE_COLS.item.w, lineGap: 1 }) + 2.5;

        doc.fontSize(7).fillColor(mutedColor).font("Helvetica").text(variantText, TABLE_COLS.item.x, textY, { width: TABLE_COLS.item.w, lineGap: 1.5 });
        textY += doc.heightOfString(variantText, { width: TABLE_COLS.item.w, lineGap: 1.5 }) + 3;

        doc.fontSize(7).fillColor(statusBadgeColor).font("Helvetica-Bold").text(statusText, TABLE_COLS.item.x, textY, { width: TABLE_COLS.item.w, lineGap: 1 });
        textY += doc.heightOfString(statusText, { width: TABLE_COLS.item.w, lineGap: 1 });

        doc.fillColor(darkColor).font("Helvetica");
        drawFittedCellText(doc, String(qty), TABLE_COLS.qty, cellY, 7.5);
        drawFittedCellText(doc, `INR ${unitPrice.toLocaleString("en-IN")}`, TABLE_COLS.unit, cellY, 7.5);

        if (offerDisc > 0) {
            doc.fillColor(successColor).font("Helvetica");
            drawFittedCellText(doc, `-INR ${offerDisc.toLocaleString("en-IN")}`, TABLE_COLS.offer, cellY, 7.5);
        } else {
            doc.fillColor(mutedColor).font("Helvetica");
            drawFittedCellText(doc, "INR 0", TABLE_COLS.offer, cellY, 7.5);
        }

        if (itemCoupon > 0) {
            doc.fillColor(successColor).font("Helvetica");
            drawFittedCellText(doc, `-INR ${itemCoupon.toLocaleString("en-IN")}`, TABLE_COLS.coupon, cellY, 7.5);
        } else {
            doc.fillColor(mutedColor).font("Helvetica");
            drawFittedCellText(doc, "INR 0", TABLE_COLS.coupon, cellY, 7.5);
        }

        doc.fillColor(darkColor).font("Helvetica");
        drawFittedCellText(doc, `INR ${taxable.toLocaleString("en-IN")}`, TABLE_COLS.taxable, cellY, 7.5);

        doc.fillColor(darkColor).font("Helvetica");
        drawFittedCellText(doc, `INR ${gst.toLocaleString("en-IN")}`, TABLE_COLS.gst, cellY, 7.5);
        doc.fontSize(6.5).fillColor(mutedColor).font("Helvetica").text("(18% Incl)", TABLE_COLS.gst.x, cellY + 9.5, { width: TABLE_COLS.gst.w, align: TABLE_COLS.gst.align });

        doc.fillColor(darkColor).font("Helvetica-Bold");
        drawFittedCellText(doc, `INR ${lineTotal.toLocaleString("en-IN")}`, TABLE_COLS.lineTotal, cellY, 8);

        y = Math.max(textY, y + rowContentHeight) + 6;
        doc.moveTo(PAGE.left, y).lineTo(PAGE.right, y).strokeColor("#f1f5f9").lineWidth(0.5).stroke();
        y += 6;
    });

    y += 10;
    if (y + 215 > PAGE.maxContentY) {
        doc.addPage();
        y = PAGE.top;
    }

    const summaryCardWidth = 278;
    const summaryCardX = PAGE.right - summaryCardWidth;
    const summaryLabelX = summaryCardX + 12;
    const summaryLabelWidth = 148;
    const summaryValX = summaryLabelX + summaryLabelWidth + 4;
    const summaryValWidth = summaryCardX + summaryCardWidth - 12 - summaryValX;
    const paymentColWidth = summaryCardX - PAGE.left - 16;

    const blockStartY = y;
    let paymentY = blockStartY;
    doc.fontSize(9.5).fillColor(darkColor).font("Helvetica-Bold");
    paymentY = drawWrappedLine(doc, "PAYMENT DETAILS", PAGE.left, paymentY, paymentColWidth, {}, 4);

    doc.fontSize(8).fillColor(mutedColor).font("Helvetica");
    paymentY = drawWrappedLine(doc, `Payment Method: ${paymentMethodDisplay}`, PAGE.left, paymentY, paymentColWidth, {}, 2.5);
    paymentY = drawWrappedLine(doc, `Payment Status: ${paymentStatusDisplay}`, PAGE.left, paymentY, paymentColWidth, {}, 2.5);
    paymentY = drawWrappedLine(doc, `Order Status: ${order.orderStatus || "Pending"}`, PAGE.left, paymentY, paymentColWidth, {}, 3);

    doc.fontSize(8).fillColor(darkColor).font("Helvetica-Bold");
    paymentY = drawWrappedLine(doc, `Purchased Price: INR ${purchasedPrice.toLocaleString("en-IN")}`, PAGE.left, paymentY, paymentColWidth, {}, 4);

    const signatoryY = Math.max(paymentY + 12, blockStartY + 65);
    doc.fontSize(9).fillColor(primaryColor).font("Helvetica-Bold").text("For DELTA", PAGE.left, signatoryY, { width: paymentColWidth });
    doc.fontSize(7.5).fillColor(mutedColor).font("Helvetica").text("Authorized Signatory & Seal", PAGE.left, signatoryY + 11, { width: paymentColWidth });

    doc.moveTo(PAGE.left, signatoryY + 52).lineTo(210, signatoryY + 52).strokeColor(borderColor).lineWidth(1).stroke();
    doc.fontSize(8).fillColor(darkColor).font("Helvetica-Bold").text("Authorized Signature", PAGE.left, signatoryY + 56, { width: paymentColWidth });
    doc.fontSize(7).fillColor(mutedColor).font("Helvetica").text("(Sign & Stamp)", PAGE.left, signatoryY + 66, { width: paymentColWidth });
    const signatoryBottom = signatoryY + 76;

    const cardTop = blockStartY;
    let cardContentY = cardTop + 10;

    const drawSummaryRow = (label, value, {
        labelFont = "Helvetica",
        labelSize = 8,
        labelColor = mutedColor,
        valFont = "Helvetica-Bold",
        valSize = 8,
        valColor = darkColor,
        gap = 4
    } = {}) => {
        doc.fontSize(labelSize).font(labelFont);
        const labelH = doc.heightOfString(label, { width: summaryLabelWidth });
        doc.fontSize(valSize).font(valFont);
        const valH = doc.heightOfString(value, { width: summaryValWidth });

        doc.fontSize(labelSize).fillColor(labelColor).font(labelFont).text(label, summaryLabelX, cardContentY, { width: summaryLabelWidth, align: "left" });
        doc.fontSize(valSize).fillColor(valColor).font(valFont).text(value, summaryValX, cardContentY, { width: summaryValWidth, align: "right" });
        cardContentY += Math.max(labelH, valH) + gap;
    };

    doc.fontSize(9.5).fillColor(darkColor).font("Helvetica-Bold");
    cardContentY = drawWrappedLine(doc, "ORDER SUMMARY", summaryLabelX, cardContentY, summaryCardWidth - 24, {}, 4);

    drawSummaryRow("Subtotal (before discounts):", `INR ${subtotalBeforeDiscounts.toLocaleString("en-IN")}`);

    if (totalOfferDiscount > 0) {
        drawSummaryRow("Offer Discount:", `-INR ${totalOfferDiscount.toLocaleString("en-IN")}`, {
            labelColor: successColor,
            valColor: successColor
        });
    }

    if (totalCouponDiscount > 0) {
        const couponCode = order.appliedCoupon?.code ? ` (${order.appliedCoupon.code})` : "";
        drawSummaryRow(`Coupon${couponCode}:`, `-INR ${totalCouponDiscount.toLocaleString("en-IN")}`, {
            labelColor: successColor,
            valColor: successColor
        });
    }

    const showCancelledDeduction = calculatedCancelledDeduction > 0 && (order.orderStatus === "Processing" || (order.cancelledAmount > 0 && refundedToWallet === 0));
    if (showCancelledDeduction) {
        drawSummaryRow("Cancelled Items (Not Purchased):", `-INR ${calculatedCancelledDeduction.toLocaleString("en-IN")}`, {
            labelColor: dangerColor,
            valColor: dangerColor
        });
    }

    drawSummaryRow("Taxable Total:", `INR ${taxableTotal.toLocaleString("en-IN")}`);
    drawSummaryRow("CGST (9%):", `INR ${cgst.toLocaleString("en-IN")}`, {
        labelSize: 7.5,
        valFont: "Helvetica",
        valSize: 7.5,
        gap: 3
    });
    drawSummaryRow("SGST (9%):", `INR ${sgst.toLocaleString("en-IN")}`, {
        labelSize: 7.5,
        valFont: "Helvetica",
        valSize: 7.5,
        gap: 3
    });
    drawSummaryRow("Total GST 18% (Included):", `INR ${totalGst.toLocaleString("en-IN")}`);
    drawSummaryRow("Shipping Charges:", shippingFee === 0 ? "FREE" : `INR ${shippingFee.toLocaleString("en-IN")}`, {
        valColor: primaryColor,
        gap: 6
    });

    doc.moveTo(summaryLabelX, cardContentY).lineTo(summaryCardX + summaryCardWidth - 12, cardContentY).strokeColor(borderColor).lineWidth(1).stroke();
    cardContentY += 6;

    let finalLabel = "Final Amount Paid:";
    if (order.orderStatus === "Delivered" || order.paymentStatus === "Completed" || order.paymentStatus === "Paid") {
        finalLabel = "TOTAL AMOUNT PAID:";
    } else if (order.paymentMethod === "Cash on Delivery" && order.orderStatus !== "Delivered") {
        finalLabel = "AMOUNT DUE UPON DELIVERY:";
    }

    drawSummaryRow(finalLabel, `INR ${finalAmountPaid.toLocaleString("en-IN")}`, {
        labelFont: "Helvetica-Bold",
        labelSize: 8.5,
        labelColor: primaryColor,
        valFont: "Helvetica-Bold",
        valSize: 9.5,
        valColor: primaryColor,
        gap: 5
    });

    if (refundedToWallet > 0) {
        drawSummaryRow("Refunded to Client Wallet:", `INR ${refundedToWallet.toLocaleString("en-IN")}`, {
            labelFont: "Helvetica-Bold",
            labelSize: 8.5,
            labelColor: successColor,
            valFont: "Helvetica-Bold",
            valSize: 9.5,
            valColor: successColor,
            gap: 5
        });
    }

    drawSummaryRow("Purchased Price:", `INR ${purchasedPrice.toLocaleString("en-IN")}`, {
        labelFont: "Helvetica-Bold",
        labelSize: 8.5,
        labelColor: darkColor,
        valFont: "Helvetica-Bold",
        valSize: 9.5,
        valColor: primaryColor,
        gap: 4
    });

    const totalCardHeight = cardContentY - cardTop + 6;
    doc.roundedRect(summaryCardX, cardTop, summaryCardWidth, totalCardHeight, 6).strokeColor(borderColor).lineWidth(1).stroke();

    let footerY = Math.max(cardTop + totalCardHeight, signatoryBottom) + 18;
    if (footerY < 712) {
        footerY = 712;
    } else if (footerY + 78 > 802) {
        doc.addPage();
        footerY = 712;
    }

    doc.rect(PAGE.left, footerY, PAGE.width, 48).fillColor("#faf8f7").fill();
    doc.rect(PAGE.left, footerY, PAGE.width, 48).strokeColor(borderColor).lineWidth(0.5).stroke();

    doc.fontSize(7.5).fillColor(goldColor).font("Helvetica-Bold").text("CERTIFICATE OF HOROLOGICAL AUTHENTICITY", 45, footerY + 7, { width: 503 });
    doc.fontSize(6.5).fillColor(mutedColor).font("Helvetica").text(
        "Every certified Swiss timepiece supplied through DELTA Private Vault is authenticated by certified master horologists and accompanied by international manufacture warranty certificates and chronometer dossiers.",
        45,
        footerY + 18,
        { width: 503, lineGap: 1.5 }
    );

    const conciergeY = Math.min(footerY + 56, 790);
    doc.fontSize(7).fillColor(mutedColor).font("Helvetica").text("Delta Vault Client Concierge • support@deltavault.com • 1-800-DELTA-H", PAGE.left, conciergeY, { align: "center", width: PAGE.width });

    doc.end();
};
