import Order from "../models/order.model.js";


export const createOrder = async (orderData) => {
    return await Order.create(orderData);
};


export const findOrderById = async (orderId) => {
    return await Order.findById(orderId);
};


export const findOrderByIdWithUser = async (orderId) => {
    return await Order.findById(orderId)
        .populate("user", "name email phone isVerified")
        .lean();
};


export const findOrderByOrderNumber = async (orderNumber) => {
    return await Order.findOne({ orderNumber: orderNumber.toUpperCase() });
};


export const findOrderByIdOrNumber = async (orderIdOrNumber, userId = null) => {
    const query = {};
    const idStr = (orderIdOrNumber || "").toString().trim();

    if (idStr.match(/^[0-9a-fA-F]{24}$/)) {
        query._id = idStr;
    } else {
        query.orderNumber = idStr.toUpperCase();
    }

    if (userId) {
        query.user = userId;
    }

    return await Order.findOne(query);
};


export const findUserOrders = async ({ userId, search = "", status = "" }) => {
    const query = { user: userId };

    if (status && status.trim()) {
        const trimmed = status.trim();
        if (trimmed === "Failed" || trimmed === "Payment Failed") {
            query.paymentStatus = "Failed";
        } else {
            query.orderStatus = trimmed;
        }
    }

    if (search && search.trim()) {
        const cleanSearch = search.trim();
        query.$or = [
            { orderNumber: { $regex: cleanSearch, $options: "i" } },
            { "items.productName": { $regex: cleanSearch, $options: "i" } },
            { "items.brandName": { $regex: cleanSearch, $options: "i" } },
            { orderStatus: { $regex: cleanSearch, $options: "i" } }
        ];
    }

    return await Order.find(query).sort({ createdAt: -1 });
};


export const findAdminOrdersWithPagination = async ({
    query = {},
    sortOptions = { createdAt: -1 },
    skip = 0,
    pageLimit = 10
}) => {
    const [orders, totalItems] = await Promise.all([
        Order.find(query).sort(sortOptions).skip(skip).limit(pageLimit).lean(),
        Order.countDocuments(query)
    ]);

    return { orders, totalItems };
};


export const findReturnsWithPagination = async ({
    query = {},
    sortOption = { returnRequestedAt: -1, updatedAt: -1 },
    skip = 0,
    pageLimit = 10
}) => {
    const [returns, totalItems] = await Promise.all([
        Order.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(pageLimit)
            .populate("user", "name email phone isVerified")
            .lean(),
        Order.countDocuments(query)
    ]);

    return { returns, totalItems };
};


export const countOrders = async (query = {}) => {
    return await Order.countDocuments(query);
};


export const updateOrderById = async (orderId, updateData, options = { new: true }) => {
    return await Order.findByIdAndUpdate(orderId, updateData, options);
};


export const saveOrder = async (orderDoc) => {
    return await orderDoc.save();
};

export default {
    createOrder,
    findOrderById,
    findOrderByIdWithUser,
    findOrderByOrderNumber,
    findOrderByIdOrNumber,
    findUserOrders,
    findAdminOrdersWithPagination,
    findReturnsWithPagination,
    countOrders,
    updateOrderById,
    saveOrder
};
