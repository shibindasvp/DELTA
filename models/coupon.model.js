import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        description: { type: String, default: "Client Coupon Discount" },
        discountType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
        discountValue: { type: Number, required: true, min: 1 },
        minPurchaseAmount: { type: Number, default: 0, min: 0 },
        maxDiscountAmount: { type: Number, default: null },
        expiryDate: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
        usageLimit: { type: Number, default: 100 },
        usageCount: { type: Number, default: 0 },
        userUsageLimit: { type: Number, default: 1, min: 1 },
        usedBy: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
                usedAt: { type: Date, default: Date.now }
            }
        ],
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false }
    },
    { timestamps: true }
);

couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ "usedBy.user": 1 });

const Coupon = mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);
export default Coupon;
