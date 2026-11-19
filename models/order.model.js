import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    brandName: { type: String, default: "DELTA" },
    variant: {
        variantId: { type: String, default: "" },
        color: { type: String, default: "Standard Edition" },
        material: { type: String, default: "Oystersteel" },
        dial: { type: String, default: "Baton Dial" },
        sku: { type: String, default: "" },
        image: { type: String, default: "" }
    },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    itemTotal: { type: Number, required: true },
    status: {
        type: String,
        enum: ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Return Requested", "Returned", "Active"],
        default: "Pending"
    },
    stockRestored: { type: Boolean, default: false },
    cancellationReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    outForDeliveryAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    returnReason: { type: String, default: "" },
    returnRequestedAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
    returnAdminNotes: { type: String, default: "" },
    returnProcessedAt: { type: Date, default: null },
    returnDeclined: { type: Boolean, default: false },
    returnDeclinedAt: { type: Date, default: null },
    refunded: { type: Boolean, default: false },
    refundAmount: { type: Number, default: 0 }
});

const orderSchema = new mongoose.Schema(
    {
        orderNumber: { type: String, required: true, unique: true, uppercase: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        collectorName: { type: String, required: true },
        collectorEmail: { type: String, required: true },
        items: [orderItemSchema],
        originalSubtotal: { type: Number, default: 0 },
        originalDiscount: { type: Number, default: 0 },
        cancelledAmount: { type: Number, default: 0 },
        returnedAmount: { type: Number, default: 0 },
        refundAmount: { type: Number, default: 0 },
        subtotal: { type: Number, required: true },
        discountAmount: { type: Number, default: 0 },
        appliedCoupon: {
            code: { type: String, default: "" },
            discountType: { type: String, default: "percentage" },
            discountValue: { type: Number, default: 0 },
            initialDiscountAmount: { type: Number, default: 0 }
        },
        appliedCoupons: [
            {
                code: { type: String, default: "" },
                discountType: { type: String, default: "percentage" },
                discountValue: { type: Number, default: 0 },
                discountAmount: { type: Number, default: 0 },
                description: { type: String, default: "" }
            }
        ],
        shippingFee: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        grandTotal: { type: Number, required: true },
        orderStatus: {
            type: String,
            enum: ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Return Requested", "Returned"],
            default: "Pending"
        },
        cancellationReason: { type: String, default: "" },
        cancelledAt: { type: Date, default: null },
        returnReason: { type: String, default: "" },
        returnRequestedAt: { type: Date, default: null },
        returnedAt: { type: Date, default: null },
        returnAdminNotes: { type: String, default: "" },
        returnProcessedAt: { type: Date, default: null },
        returnDeclined: { type: Boolean, default: false },
        returnDeclinedAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        paymentMethod: {
            type: String,
            enum: ["Vault Card", "Razorpay", "PayPal", "Bank Wire", "Cash on Delivery", "Wallet"],
            default: "Cash on Delivery"
        },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Completed", "Failed", "Refunded"],
            default: "Pending"
        },
        razorpayOrderId: { type: String, default: "" },
        razorpayPaymentId: { type: String, default: "" },
        razorpaySignature: { type: String, default: "" },
        paypalOrderId: { type: String, default: "" },
        paypalCaptureId: { type: String, default: "" },
        paymentFailureReason: { type: String, default: "" },
        isStockDeducted: { type: Boolean, default: false },
        declinedAt: { type: Date, default: null },
        paidAt: { type: Date, default: null },
        shippingAddress: {
            fullName: { type: String },
            street: { type: String },
            city: { type: String },
            state: { type: String },
            postalCode: { type: String },
            country: { type: String, default: "India" },
            mobile: { type: String }
        },
        notes: { type: String, default: "White-Glove Insured Delivery" }
    },
    { timestamps: true }
);

orderSchema.index({ orderNumber: 1, user: 1, orderStatus: 1, createdAt: -1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;
