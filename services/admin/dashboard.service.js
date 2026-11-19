import User from "../../models/user.model.js";
import Product from "../../models/product.model.js";
import Brand from "../../models/brand.model.js";
import Order from "../../models/order.model.js";

export const PURCHASED_ORDER_FILTER = {
    $or: [
        { paymentStatus: "Completed" },
        { orderStatus: "Delivered" }
    ],
    orderStatus: { $nin: ["Cancelled", "Returned", "Return Requested"] },
    paymentStatus: { $nin: ["Failed", "Refunded"] }
};

export const getDashboardStats = async (timeframe = "30d") => {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isBlocked: false });
    const blockedUsers = await User.countDocuments({ isBlocked: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true });

    const totalProducts = await Product.countDocuments({ isDeleted: false });
    const activeProducts = await Product.countDocuments({ isDeleted: false, isActive: true });
    const lowStockCount = await Product.countDocuments({ isDeleted: false, stock: { $gt: 0, $lte: 5 } });
    const outOfStockCount = await Product.countDocuments({ isDeleted: false, stock: { $lte: 0 } });

    const totalBrands = await Brand.countDocuments({ isDeleted: false });
    const activeBrands = await Brand.countDocuments({ isDeleted: false, isActive: true });

    const totalOrders = await Order.countDocuments(PURCHASED_ORDER_FILTER);
    
    const revenueAgg = await Order.aggregate([
        { $match: PURCHASED_ORDER_FILTER },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const ordersToday = await Order.countDocuments({
        ...PURCHASED_ORDER_FILTER,
        createdAt: { $gte: startOfToday }
    });

    const totalReturns = await Order.countDocuments({ orderStatus: { $in: ["Return Requested", "Returned"] } });

    const days = timeframe === "7d" ? 7 : 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - (days - 1));
    sinceDate.setHours(0, 0, 0, 0);

    const dailyAgg = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: sinceDate },
                ...PURCHASED_ORDER_FILTER
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                },
                revenue: { $sum: "$grandTotal" },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const dailyMap = new Map();
    dailyAgg.forEach(item => dailyMap.set(item._id, item));

    const salesTimeline = [];
    let maxDailyRev = 0;
    for (let i = 0; i < days; i++) {
        const d = new Date(sinceDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const record = dailyMap.get(dateStr) || { revenue: 0, count: 0 };
        if (record.revenue > maxDailyRev) maxDailyRev = record.revenue;
        salesTimeline.push({
            date: dateStr,
            label: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
            revenue: record.revenue,
            count: record.count
        });
    }

    let chartPath = "";
    let areaPath = "";
    if (salesTimeline.length > 1) {
        const safeMax = maxDailyRev > 0 ? maxDailyRev : 100000;
        const points = salesTimeline.map((pt, idx) => {
            const x = Math.round((idx / (salesTimeline.length - 1)) * 500);
            const y = Math.round(160 - ((pt.revenue / safeMax) * 130));
            return { x, y };
        });

        chartPath = `M ${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L ${p.x},${p.y}`).join(" ");
        areaPath = `${chartPath} L 500,180 L 0,180 Z`;
    }

    const topTimepieces = await Order.aggregate([
        { $match: PURCHASED_ORDER_FILTER },
        { $unwind: "$items" },
        {
            $group: {
                _id: "$items.productName",
                brandName: { $first: "$items.brandName" },
                unitsSold: { $sum: "$items.quantity" },
                totalRevenue: { $sum: "$items.itemTotal" }
            }
        },
        { $sort: { unitsSold: -1, totalRevenue: -1 } },
        { $limit: 5 }
    ]);

    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);
    const topProducts = await Product.find({ isDeleted: false, isActive: true }).populate("brand", "name").sort({ createdAt: -1 }).limit(4);

    return {
        totalUsers,
        activeUsers,
        blockedUsers,
        verifiedUsers,
        totalProducts,
        activeProducts,
        lowStockCount,
        outOfStockCount,
        totalBrands,
        activeBrands,
        totalOrders,
        ordersToday,
        totalRevenue,
        totalReturns,
        salesTimeline,
        chartPath,
        areaPath,
        timeframe,
        topTimepieces,
        recentUsers,
        topProducts
    };
};
