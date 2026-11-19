import { 
    getOrdersList, 
    getOrderByIdAdmin, 
    updateOrderStatus, 
    updateOrderItemStatus,
    getReturnsList,
    approveOrderReturn,
    declineOrderReturn,
    approveItemReturn,
    declineItemReturn
} from "../../services/admin/order.service.js";
import Order from "../../models/order.model.js";
import { generateOrderInvoicePdf } from "../../helpers/invoice.helper.js";
import { isAjaxRequest, normalizeError, respondWithError } from "../../utils/error.js";

export const showOrders = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const status = req.query.status || "";
        const paymentMethod = req.query.paymentMethod || "";
        const sort = req.query.sort || "newest";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const [
            { orders, pagination },
            totalOrders,
            pendingOrders,
            shippedOrders,
            outForDeliveryOrders,
            deliveredOrders,
            cancelledOrders
        ] = await Promise.all([
            getOrdersList({ search, status, paymentMethod, sort, page, limit }),
            Order.countDocuments(),
            Order.countDocuments({ orderStatus: "Pending" }),
            Order.countDocuments({ orderStatus: "Shipped" }),
            Order.countDocuments({ orderStatus: "Out for Delivery" }),
            Order.countDocuments({ orderStatus: "Delivered" }),
            Order.countDocuments({ orderStatus: "Cancelled" })
        ]);

        const stats = {
            totalOrders,
            pendingOrders,
            shippedOrders,
            outForDeliveryOrders,
            deliveredOrders,
            cancelledOrders
        };

        if (req.xhr || req.headers?.accept?.includes("json") || req.query.ajax === "true") {
            return res.json({
                success: true,
                orders,
                pagination,
                search,
                status,
                paymentMethod,
                sort,
                stats
            });
        }

        res.render("admin/orders/index", {
            orders,
            pagination,
            search,
            status,
            paymentMethod,
            sort,
            stats,
            admin: req.admin || res.locals.currentAdmin,
            title: "Orders — DELTA Administration"
        });
    } catch (error) {
        if (isAjaxRequest(req)) {
            const { statusCode, message } = normalizeError(error, "Unable to load orders list.");
            return res.status(statusCode).json({ success: false, message });
        }
        next(error);
    }
};

export const showOrderDetailAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await getOrderByIdAdmin(id);

        if (req.xhr || req.headers?.accept?.includes("json") || req.query.ajax === "true") {
            return res.json({
                success: true,
                order
            });
        }

        res.render("admin/orders/detail", {
            order,
            admin: req.admin || res.locals.currentAdmin,
            title: `Order ${order.orderNumber} Dossier — DELTA Administration`
        });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Order not found.", 404);
        if (isAjaxRequest(req)) {
            return res.status(statusCode).json({ success: false, message });
        }
        return res.status(statusCode === 500 ? 500 : 404).render(statusCode === 500 ? "errors/500" : "errors/404", {
            statusCode,
            isAdmin: true,
            url: req.originalUrl,
            message
        });
    }
};

export const updateOrderStatusHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        const updatedOrder = await updateOrderStatus(id, status, reason);

        if (req.xhr || req.headers?.accept?.includes("json")) {
            const [
                totalOrders,
                pendingOrders,
                shippedOrders,
                outForDeliveryOrders,
                deliveredOrders,
                cancelledOrders
            ] = await Promise.all([
                Order.countDocuments(),
                Order.countDocuments({ orderStatus: "Pending" }),
                Order.countDocuments({ orderStatus: "Shipped" }),
                Order.countDocuments({ orderStatus: "Out for Delivery" }),
                Order.countDocuments({ orderStatus: "Delivered" }),
                Order.countDocuments({ orderStatus: "Cancelled" })
            ]);

            return res.json({
                success: true,
                message: `Order ${updatedOrder.orderNumber} status updated to "${updatedOrder.orderStatus}".`,
                order: updatedOrder,
                stats: {
                    totalOrders,
                    pendingOrders,
                    shippedOrders,
                    outForDeliveryOrders,
                    deliveredOrders,
                    cancelledOrders
                }
            });
        }

        res.redirect("/admin/orders/" + id);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to update order status.",
            redirectUrl: "/admin/orders"
        });
    }
};

export const updateOrderItemStatusHandler = async (req, res, next) => {
    try {
        const { id, itemId } = req.params;
        const { status, reason } = req.body;

        const { order, item } = await updateOrderItemStatus(id, itemId, status, reason);

        if (req.xhr || req.headers?.accept?.includes("json")) {
            return res.json({
                success: true,
                message: `Timepiece "${item.productName}" status updated to "${item.status}".`,
                order,
                item
            });
        }

        res.redirect(`/admin/orders/${id}`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to update item status.",
            redirectUrl: `/admin/orders/${req.params.id}`
        });
    }
};

export const downloadAdminOrderInvoiceHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).render("errors/404", { url: req.originalUrl, message: "Order not found." });
        }
        generateOrderInvoicePdf(order, res);
    } catch (error) {
        next(error);
    }
};


export const showReturns = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const status = req.query.status || "";
        const sort = req.query.sort || "newest";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const [
            { returns, pagination },
            pendingReturns,
            completedReturns,
            totalReturns,
            valuationAgg
        ] = await Promise.all([
            getReturnsList({ search, status, sort, page, limit }),
            Order.countDocuments({
                $or: [
                    { orderStatus: "Return Requested" },
                    { "items.status": "Return Requested" }
                ]
            }),
            Order.countDocuments({
                $or: [
                    { orderStatus: "Returned" },
                    { "items.status": "Returned" }
                ]
            }),
            Order.countDocuments({
                $or: [
                    { orderStatus: { $in: ["Return Requested", "Returned"] } },
                    { "items.status": { $in: ["Return Requested", "Returned"] } }
                ]
            }),
            Order.aggregate([
                {
                    $match: {
                        $or: [
                            { orderStatus: "Returned" },
                            { "items.status": "Returned" }
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalValuation: { $sum: "$grandTotal" }
                    }
                }
            ])
        ]);

        const stats = {
            pendingReturns,
            completedReturns,
            totalReturns,
            returnedValuation: valuationAgg.length > 0 ? valuationAgg[0].totalValuation : 0
        };

        if (req.xhr || req.headers?.accept?.includes("json") || req.query.ajax === "true") {
            return res.json({
                success: true,
                returns,
                pagination,
                search,
                status,
                sort,
                stats
            });
        }

        res.render("admin/returns/index", {
            returns,
            pagination,
            search,
            status,
            sort,
            stats,
            admin: req.admin || res.locals.currentAdmin,
            title: "Returns & Reverse Logistics — DELTA Administration"
        });
    } catch (error) {
        if (isAjaxRequest(req)) {
            const { statusCode, message } = normalizeError(error, "Unable to load return requests.");
            return res.status(statusCode).json({ success: false, message });
        }
        next(error);
    }
};


export const approveReturnHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { adminNotes = "" } = req.body;

        const order = await approveOrderReturn(id, adminNotes);

        if (req.xhr || req.headers?.accept?.includes("json")) {
            return res.json({
                success: true,
                message: `Order ${order.orderNumber} return confirmed, restocked to vault, and refund credited to collector's Vault Wallet.`,
                order
            });
        }

        res.redirect(`/admin/returns?success=true`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to approve return request.",
            redirectUrl: "/admin/returns"
        });
    }
};


export const declineReturnHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { declineReason = "" } = req.body;

        const order = await declineOrderReturn(id, declineReason);

        if (req.xhr || req.headers?.accept?.includes("json")) {
            return res.json({
                success: true,
                message: `Order ${order.orderNumber} return request has been declined.`,
                order
            });
        }

        res.redirect(`/admin/returns?success=true`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to decline return request.",
            redirectUrl: "/admin/returns"
        });
    }
};


export const approveItemReturnHandler = async (req, res, next) => {
    try {
        const { id, itemId } = req.params;
        const { adminNotes = "" } = req.body;

        const { order, item } = await approveItemReturn(id, itemId, adminNotes);

        if (req.xhr || req.headers?.accept?.includes("json")) {
            return res.json({
                success: true,
                message: `Timepiece "${item.productName}" return confirmed, restocked, and refund credited to collector's Vault Wallet.`,
                order,
                item
            });
        }

        res.redirect(`/admin/orders/${id}?success=true`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to approve item return request.",
            redirectUrl: `/admin/orders/${req.params.id}`
        });
    }
};


export const declineItemReturnHandler = async (req, res, next) => {
    try {
        const { id, itemId } = req.params;
        const { declineReason = "" } = req.body;

        const { order, item } = await declineItemReturn(id, itemId, declineReason);

        if (req.xhr || req.headers?.accept?.includes("json")) {
            return res.json({
                success: true,
                message: `Timepiece "${item.productName}" return request declined.`,
                order,
                item
            });
        }

        res.redirect(`/admin/orders/${id}?success=true`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to decline item return request.",
            redirectUrl: `/admin/orders/${req.params.id}`
        });
    }
};

