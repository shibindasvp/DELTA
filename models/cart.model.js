import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    variant: {
        variantId: { type: String, default: "" },
        color: { type: String, default: "Standard" },
        colorCode: { type: String, default: "#1b1c1c" },
        material: { type: String, default: "Oystersteel 904L" },
        dial: { type: String, default: "Sunburst Dial" },
        sku: { type: String, default: "" },
        images: [{ type: String }]
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { timestamps: true });

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true
    },
    items: [cartItemSchema],
    appliedCoupon: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    appliedCoupons: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    discountAmount: { type: Number, default: 0 }
}, { timestamps: true });

const Cart = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
export default Cart;
