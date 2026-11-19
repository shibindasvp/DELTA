import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema({
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
        images: [{ type: String }],
        price: { type: Number, default: 0 },
        discountPrice: { type: Number, default: null }
    }
}, { timestamps: true });

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true
    },
    items: [wishlistItemSchema],
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    }]
}, { timestamps: true });

const Wishlist = mongoose.models.Wishlist || mongoose.model("Wishlist", wishlistSchema);
export default Wishlist;
