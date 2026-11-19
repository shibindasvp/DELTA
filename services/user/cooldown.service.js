import Order from "../../models/order.model.js";

export const DECLINE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes


export const getDeclineCooldownForProduct = async (userId, productId) => {
    if (!userId || !productId) {
        return { inCooldown: false, remainingMs: 0, remainingSeconds: 0 };
    }

    const fiveMinutesAgo = new Date(Date.now() - DECLINE_COOLDOWN_MS);

    const recentDeclined = await Order.findOne({
        user: userId,
        paymentStatus: "Failed",
        orderStatus: { $ne: "Cancelled" },
        "items.product": productId,
        declinedAt: { $gte: fiveMinutesAgo }
    }).sort({ declinedAt: -1 });

    if (!recentDeclined || !recentDeclined.declinedAt) {
        return { inCooldown: false, remainingMs: 0, remainingSeconds: 0 };
    }

    const lastDeclined = recentDeclined.declinedAt;
    const elapsed = Date.now() - new Date(lastDeclined).getTime();

    if (elapsed < DECLINE_COOLDOWN_MS) {
        const remainingMs = DECLINE_COOLDOWN_MS - elapsed;
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        return {
            inCooldown: true,
            remainingMs,
            remainingSeconds,
            declinedAt: lastDeclined,
            orderId: recentDeclined._id,
            orderNumber: recentDeclined.orderNumber
        };
    }

    return { inCooldown: false, remainingMs: 0, remainingSeconds: 0, declinedAt: lastDeclined };
};


export const getDeclineCooldownForOrder = (order) => {
    if (!order || order.paymentStatus !== "Failed" || order.orderStatus === "Cancelled") {
        return { inCooldown: false, remainingMs: 0, remainingSeconds: 0 };
    }

    const lastDeclined = order.declinedAt;
    if (!lastDeclined) {
        return { inCooldown: false, remainingMs: 0, remainingSeconds: 0 };
    }

    const elapsed = Date.now() - new Date(lastDeclined).getTime();

    if (elapsed < DECLINE_COOLDOWN_MS) {
        const remainingMs = DECLINE_COOLDOWN_MS - elapsed;
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        return {
            inCooldown: true,
            remainingMs,
            remainingSeconds,
            declinedAt: lastDeclined
        };
    }

    return { inCooldown: false, remainingMs: 0, remainingSeconds: 0, declinedAt: lastDeclined };
};


export const assertProductNotUnderDeclineCooldown = async (userId, productId, productName = "This timepiece") => {
    const cd = await getDeclineCooldownForProduct(userId, productId);
    if (cd.inCooldown) {
        const mins = Math.floor(cd.remainingSeconds / 60);
        const secs = cd.remainingSeconds % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        throw new Error(`Payment for "${productName}" was recently declined. In accordance with vault security policy, you can re-buy this timepiece only after 5 minutes (${timeStr} remaining).`);
    }
};


export const assertOrderNotUnderDeclineCooldown = (order) => {
    const cd = getDeclineCooldownForOrder(order);
    if (cd.inCooldown) {
        const mins = Math.floor(cd.remainingSeconds / 60);
        const secs = cd.remainingSeconds % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        throw new Error(`Payment for order ${order.orderNumber} was declined less than 5 minutes ago. You can re-attempt settlement only after 5 minutes (${timeStr} remaining).`);
    }
};
