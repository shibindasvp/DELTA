import Coupon from "../../models/coupon.model.js";
import { getPaginationData } from "../../utils/pagination.js";


export const getCouponsList = async ({
    search = "",
    status = "all",
    discountType = "all",
    sort = "newest",
    page = 1,
    limit = 10
} = {}) => {
    const query = { isDeleted: false };


    if (search && search.trim() !== "") {
        const s = search.trim();
        query.$or = [
            { code: { $regex: s, $options: "i" } },
            { description: { $regex: s, $options: "i" } }
        ];
    }

    const now = new Date();


    if (status === "active") {
        query.isActive = true;
        query.$or = [
            { expiryDate: null },
            { expiryDate: { $gte: now } }
        ];
    } else if (status === "inactive") {
        query.isActive = false;
    } else if (status === "expired") {
        query.expiryDate = { $lt: now };
    }


    if (discountType === "percentage" || discountType === "fixed") {
        query.discountType = discountType;
    }

    let sortOptions = { createdAt: -1 };
    if (sort === "oldest") {
        sortOptions = { createdAt: 1 };
    } else if (sort === "code-asc") {
        sortOptions = { code: 1 };
    } else if (sort === "code-desc") {
        sortOptions = { code: -1 };
    } else if (sort === "discount-high") {
        sortOptions = { discountValue: -1 };
    } else if (sort === "discount-low") {
        sortOptions = { discountValue: 1 };
    } else if (sort === "expiry-soon") {
        sortOptions = { expiryDate: 1 };
    }

    const currentPage = Math.max(1, parseInt(page) || 1);
    const pageLimit = Math.max(1, parseInt(limit) || 10);
    const skip = (currentPage - 1) * pageLimit;

    const [
        coupons,
        totalCoupons,
        allCount,
        activeCount,
        inactiveCount,
        expiredCount
    ] = await Promise.all([
        Coupon.find(query).sort(sortOptions).skip(skip).limit(pageLimit).lean(),
        Coupon.countDocuments(query),
        Coupon.countDocuments({ isDeleted: false }),
        Coupon.countDocuments({ 
            isDeleted: false, 
            isActive: true, 
            $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] 
        }),
        Coupon.countDocuments({ isDeleted: false, isActive: false }),
        Coupon.countDocuments({ isDeleted: false, expiryDate: { $lt: now } })
    ]);

    const pagination = getPaginationData({
        page: currentPage,
        limit: pageLimit,
        totalItems: totalCoupons
    });
    pagination.page = currentPage;
    pagination.limit = pageLimit;
    pagination.totalCoupons = totalCoupons;

    const enrichedCoupons = coupons.map(c => {
        const isExpired = c.expiryDate && new Date(c.expiryDate) < now;
        const isLimitReached = c.usageLimit && c.usageCount >= c.usageLimit;
        return {
            ...c,
            isExpired,
            isLimitReached,
            computedStatus: isExpired ? "Expired" : (c.isActive ? (isLimitReached ? "Limit Reached" : "Active") : "Inactive")
        };
    });

    return {
        coupons: enrichedCoupons,
        stats: {
            allCount,
            activeCount,
            inactiveCount,
            expiredCount
        },
        pagination
    };
};


export const getCouponById = async (couponId) => {
    const coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
    if (!coupon) {
        throw new Error("Coupon not found in vault registry.");
    }
    return coupon;
};


export const createCoupon = async ({
    code,
    description = "",
    discountType = "percentage",
    discountValue,
    minPurchaseAmount = 0,
    maxDiscountAmount = null,
    expiryDate,
    usageLimit = 100,
    isActive = true
}) => {

    if (!code || typeof code !== "string" || !code.trim()) {
        throw new Error("Coupon code is required.");
    }

    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9_-]{3,20}$/.test(cleanCode)) {
        throw new Error("Coupon code must be between 3 and 20 uppercase alphanumeric characters (hyphens and underscores allowed).");
    }

    const existing = await Coupon.findOne({ code: cleanCode, isDeleted: false });
    if (existing) {
        throw new Error(`Coupon code "${cleanCode}" already exists in the catalog.`);
    }


    if (!["percentage", "fixed"].includes(discountType)) {
        throw new Error("Discount type must be either 'percentage' or 'fixed'.");
    }

    const numDiscountValue = Number(discountValue);
    if (isNaN(numDiscountValue) || numDiscountValue <= 0) {
        throw new Error("Discount value must be a positive number greater than 0.");
    }

    if (discountType === "percentage") {
        if (numDiscountValue >= 80) {
            throw new Error("Percentage discount must be less than 80% (cannot be 80% or greater).");
        }
    }


    const numMinPurchase = Number(minPurchaseAmount) || 0;
    if (numMinPurchase < 0) {
        throw new Error("Minimum purchase amount cannot be negative.");
    }


    let numMaxDiscount = null;
    if (maxDiscountAmount !== null && maxDiscountAmount !== undefined && maxDiscountAmount !== "") {
        numMaxDiscount = Number(maxDiscountAmount);
        if (isNaN(numMaxDiscount) || numMaxDiscount <= 0) {
            throw new Error("Maximum discount cap must be a positive number.");
        }
    }


    let parsedExpiry = null;
    if (expiryDate) {
        parsedExpiry = new Date(expiryDate);
        if (isNaN(parsedExpiry.getTime())) {
            throw new Error("Invalid expiry date format.");
        }
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (parsedExpiry < now) {
            throw new Error("Coupon expiry date must be set to today or a future date.");
        }
    } else {

        parsedExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    }


    const numUsageLimit = Number(usageLimit);
    if (isNaN(numUsageLimit) || numUsageLimit < 1) {
        throw new Error("Usage limit must be at least 1 redemption.");
    }

    const newCoupon = await Coupon.create({
        code: cleanCode,
        description: description.trim() || `Client Coupon Discount (${cleanCode})`,
        discountType,
        discountValue: numDiscountValue,
        minPurchaseAmount: numMinPurchase,
        maxDiscountAmount: discountType === "percentage" ? numMaxDiscount : null,
        expiryDate: parsedExpiry,
        usageLimit: numUsageLimit,
        usageCount: 0,
        isActive: Boolean(isActive),
        isDeleted: false
    });

    return newCoupon;
};


export const updateCoupon = async (couponId, data) => {
    const coupon = await getCouponById(couponId);


    if (data.code && data.code.trim().toUpperCase() !== coupon.code) {
        const cleanCode = data.code.trim().toUpperCase().replace(/\s+/g, "");
        if (!/^[A-Z0-9_-]{3,20}$/.test(cleanCode)) {
            throw new Error("Coupon code must be between 3 and 20 uppercase alphanumeric characters.");
        }
        const existing = await Coupon.findOne({ 
            code: cleanCode, 
            _id: { $ne: coupon._id }, 
            isDeleted: false 
        });
        if (existing) {
            throw new Error(`Coupon code "${cleanCode}" already exists.`);
        }
        coupon.code = cleanCode;
    }

    if (data.description !== undefined) {
        coupon.description = data.description.trim();
    }

    if (data.discountType !== undefined) {
        if (!["percentage", "fixed"].includes(data.discountType)) {
            throw new Error("Discount type must be either 'percentage' or 'fixed'.");
        }
        coupon.discountType = data.discountType;
    }

    if (data.discountValue !== undefined) {
        const val = Number(data.discountValue);
        if (isNaN(val) || val <= 0) {
            throw new Error("Discount value must be greater than 0.");
        }
        coupon.discountValue = val;
    }

    if (coupon.discountType === "percentage" && coupon.discountValue >= 80) {
        throw new Error("Percentage discount must be less than 80% (cannot be 80% or greater).");
    }

    if (data.minPurchaseAmount !== undefined) {
        const minVal = Number(data.minPurchaseAmount) || 0;
        if (minVal < 0) {
            throw new Error("Minimum purchase cannot be negative.");
        }
        coupon.minPurchaseAmount = minVal;
    }

    if (coupon.discountType === "fixed") {
        coupon.maxDiscountAmount = null;
    } else if (data.maxDiscountAmount !== undefined) {
        if (data.maxDiscountAmount === "" || data.maxDiscountAmount === null) {
            coupon.maxDiscountAmount = null;
        } else {
            const maxVal = Number(data.maxDiscountAmount);
            if (isNaN(maxVal) || maxVal <= 0) {
                throw new Error("Maximum discount amount must be greater than 0.");
            }
            coupon.maxDiscountAmount = maxVal;
        }
    }

    if (data.expiryDate) {
        const exp = new Date(data.expiryDate);
        if (isNaN(exp.getTime())) {
            throw new Error("Invalid expiry date format.");
        }
        coupon.expiryDate = exp;
    }

    if (data.usageLimit !== undefined) {
        const limitVal = Number(data.usageLimit);
        if (isNaN(limitVal) || limitVal < 1) {
            throw new Error("Usage limit must be at least 1.");
        }
        coupon.usageLimit = limitVal;
    }

    if (data.isActive !== undefined) {
        coupon.isActive = Boolean(data.isActive);
    }

    await coupon.save();
    return coupon;
};


export const toggleCouponStatus = async (couponId) => {
    const coupon = await getCouponById(couponId);
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    return coupon;
};


export const deleteCoupon = async (couponId) => {
    const coupon = await getCouponById(couponId);
    coupon.isDeleted = true;
    coupon.isActive = false;
    await coupon.save();
    return coupon;
};
