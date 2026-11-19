import Coupon from "../../models/coupon.model.js";
import Order from "../../models/order.model.js";

export const ensureDefaultCouponsExist = async () => {
    const defaultCoupons = [
        {
            code: "DELTA10",
            description: "10% Coupon Discount for Private Collectors",
            discountType: "percentage",
            discountValue: 10,
            minPurchaseAmount: 100000,
            maxDiscountAmount: 500000,
            isActive: true
        },
        {
            code: "ROYAL5",
            description: "5% Welcome Coupon on Haute Horlogerie Timepieces",
            discountType: "percentage",
            discountValue: 5,
            minPurchaseAmount: 50000,
            maxDiscountAmount: 200000,
            isActive: true
        },
        {
            code: "HERITAGE100K",
            description: "₹1,00,000 Flat Direct Credit on Orders Above ₹10,00,000",
            discountType: "fixed",
            discountValue: 100000,
            minPurchaseAmount: 1000000,
            isActive: true
        }
    ];

    for (const c of defaultCoupons) {
        const existing = await Coupon.findOne({ code: c.code });
        if (!existing) {
            await Coupon.create(c);
        }
    }
};

export const validateAndApplyCoupon = async (code, subtotal, userId = null, originalSubtotal = null, existingCoupons = []) => {
    await ensureDefaultCouponsExist();

    if (!code || typeof code !== "string" || !code.trim()) {
        throw new Error("Please enter a valid coupon code.");
    }

    const cleanCode = code.trim().toUpperCase();

    if (Array.isArray(existingCoupons) && existingCoupons.some(c => c && c.code && c.code.toUpperCase() === cleanCode)) {
        throw new Error(`Coupon code "${cleanCode}" is already applied to your order.`);
    }

    const coupon = await Coupon.findOne({ code: cleanCode, isDeleted: false });

    if (!coupon) {
        const deletedCoupon = await Coupon.findOne({ code: cleanCode, isDeleted: true });
        if (deletedCoupon) {
            const blockedError = new Error(`Coupon code "${cleanCode}" has been inactivated by admin and is blocked from use.`);
            blockedError.code = "COUPON_BLOCKED";
            blockedError.isBlocked = true;
            blockedError.isInactive = true;
            throw blockedError;
        }
        throw new Error(`Coupon code "${cleanCode}" is invalid or does not exist.`);
    }

    if (!coupon.isActive) {
        const blockedError = new Error(`Coupon code "${cleanCode}" has been inactivated by admin and is blocked from use.`);
        blockedError.code = "COUPON_BLOCKED";
        blockedError.isBlocked = true;
        blockedError.isInactive = true;
        throw blockedError;
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        throw new Error(`Coupon code "${cleanCode}" has expired.`);
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        throw new Error(`Coupon code "${cleanCode}" has reached maximum usage limit.`);
    }

    if (userId) {
        const userUsageLimit = coupon.userUsageLimit || 1;
        const usedByCount = coupon.usedBy
            ? coupon.usedBy.filter(u => u.user && u.user.toString() === userId.toString()).length
            : 0;

        const previousOrders = await Order.countDocuments({
            user: userId,
            $or: [
                { "appliedCoupon.code": cleanCode },
                { "appliedCoupons.code": cleanCode }
            ],
            orderStatus: { $ne: "Cancelled" },
            paymentStatus: { $ne: "Failed" }
        });

        const effectiveUsageCount = Math.max(usedByCount, previousOrders);
        if (effectiveUsageCount >= userUsageLimit) {
            throw new Error(
                `You have already redeemed coupon code "${cleanCode}". Each coupon code can only be used once per collector.`
            );
        }
    }

    if (subtotal < coupon.minPurchaseAmount) {
        throw new Error(
            `Code "${cleanCode}" requires a minimum collection value of ₹${coupon.minPurchaseAmount.toLocaleString("en-IN")}.`
        );
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
        discount = Math.round((subtotal * coupon.discountValue) / 100);
        if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
            discount = coupon.maxDiscountAmount;
        }
    } else {
        discount = Math.min(coupon.discountValue, subtotal);
    }

    const effectiveOriginalTotal = (originalSubtotal && originalSubtotal >= subtotal) ? originalSubtotal : subtotal;
    const productOfferDiscount = Math.max(0, effectiveOriginalTotal - subtotal);
    const existingCouponsDiscount = Array.isArray(existingCoupons)
        ? existingCoupons.reduce((sum, c) => sum + (Number(c.discountAmount) || 0), 0)
        : 0;
    const totalProposedDiscount = productOfferDiscount + existingCouponsDiscount + discount;
    const maxPermissibleTotal = Math.floor(effectiveOriginalTotal * 0.80);

    if (totalProposedDiscount >= maxPermissibleTotal || (totalProposedDiscount / effectiveOriginalTotal) >= 0.80) {
        throw new Error(
            `Cannot apply coupon: Total discount across offers and coupons cannot be 80% or greater (maximum discount must be strictly under 80%).`
        );
    }

    const totalCouponDiscountProposed = existingCouponsDiscount + discount;
    if (totalCouponDiscountProposed >= Math.floor(subtotal * 0.80) || (totalCouponDiscountProposed / subtotal) >= 0.80) {
        throw new Error(
            `Cannot apply coupon: Total coupon discount cannot be 80% or greater.`
        );
    }

    const newSubtotal = Math.max(0, subtotal - discount);

    return {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
        newSubtotal,
        originalSubtotal: effectiveOriginalTotal
    };
};


export const getAvailableCoupons = async (subtotal = 0, userId = null, originalSubtotal = null) => {
    await ensureDefaultCouponsExist();
    const now = new Date();

    const coupons = await Coupon.find({
        isActive: true,
        isDeleted: false,
        $or: [
            { expiryDate: null },
            { expiryDate: { $gte: now } }
        ]
    }).sort({ minPurchaseAmount: 1 }).lean();

    let userUsedCodes = new Set();
    if (userId) {
        const previousOrders = await Order.find({
            user: userId,
            $or: [
                { "appliedCoupon.code": { $exists: true, $ne: "" } },
                { "appliedCoupons.code": { $exists: true, $ne: "" } }
            ],
            orderStatus: { $ne: "Cancelled" },
            paymentStatus: { $ne: "Failed" }
        }).select("appliedCoupon.code appliedCoupons.code").lean();

        for (const o of previousOrders) {
            if (o.appliedCoupon && o.appliedCoupon.code) {
                userUsedCodes.add(o.appliedCoupon.code.toUpperCase());
            }
            if (Array.isArray(o.appliedCoupons)) {
                for (const ac of o.appliedCoupons) {
                    if (ac && ac.code) {
                        userUsedCodes.add(ac.code.toUpperCase());
                    }
                }
            }
        }
    }

    return coupons.filter(c => !c.usageLimit || c.usageCount < c.usageLimit).map(c => {
        const isAlreadyUsed = userId ? (
            userUsedCodes.has(c.code.toUpperCase()) || 
            (c.usedBy && c.usedBy.some(u => u.user && u.user.toString() === userId.toString()))
        ) : false;

        const meetsThreshold = subtotal >= c.minPurchaseAmount;
        const isEligible = meetsThreshold && !isAlreadyUsed;

        let estimatedDiscount = 0;
        if (isEligible && subtotal > 0) {
            if (c.discountType === "percentage") {
                estimatedDiscount = Math.round((subtotal * c.discountValue) / 100);
                if (c.maxDiscountAmount && estimatedDiscount > c.maxDiscountAmount) {
                    estimatedDiscount = c.maxDiscountAmount;
                }
            } else {
                estimatedDiscount = Math.min(c.discountValue, subtotal);
            }

            const effectiveOriginal = (originalSubtotal && originalSubtotal >= subtotal) ? originalSubtotal : subtotal;
            const productOfferDiscount = Math.max(0, effectiveOriginal - subtotal);
            const maxTotalDiscount = Math.floor(effectiveOriginal * 0.80);
            const maxCouponFromCap = Math.max(0, maxTotalDiscount - productOfferDiscount);
            const maxCouponOnSubtotal = Math.floor(subtotal * 0.80);
            const maxAllowed = Math.min(maxCouponOnSubtotal, maxCouponFromCap);

            estimatedDiscount = Math.min(estimatedDiscount, maxAllowed);
        }

        return {
            code: c.code,
            description: c.description,
            discountType: c.discountType,
            discountValue: c.discountValue,
            minPurchaseAmount: c.minPurchaseAmount,
            maxDiscountAmount: c.maxDiscountAmount,
            expiryDate: c.expiryDate,
            alreadyRedeemed: isAlreadyUsed,
            isEligible,
            estimatedDiscount
        };
    });
};
