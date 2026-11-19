import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
    sku: { type: String, trim: true, default: "" },
    color: { type: String, required: true, trim: true },
    colorCode: { type: String, default: "#1b1c1c" },
    material: { type: String, required: true, trim: true },
    dial: { type: String, required: true, trim: true },
    price: { 
        type: Number, 
        min: 0, 
        default: function() {
            try {
                if (typeof this.parent === "function" && this.parent()) {
                    return this.parent().price || 1000000;
                }
            } catch (e) {}
            return 1000000;
        } 
    },
    discountPrice: { type: Number, min: 0, default: null },
    stock: { type: Number, min: 0, default: 0},
    description: { type: String, default: "" },
    images: [{ type: String }],
    isDefault: { type: Boolean, default: false }
});

const specsSchema = new mongoose.Schema(
    {
        case: { type: String, default: "" },
        caseDetails: { type: String, default: "" },
        dial: { type: String, default: "" },
        dialDetails: { type: String, default: "" },
        movement: { type: String, default: "" },
        movementDetails: { type: String, default: "" },
        bracelet: { type: String, default: "" },
        braceletDetails: { type: String, default: "" }
    },
    { _id: false }
);

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true },
        brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true },
        brandName: { type: String, default: "DELTA Manufacture" },
        modelNumber: { type: String, trim: true, default: "" },
        description: { type: String, default: "" },
        price: { type: Number, required: true, min: 0, max: 200000000 },
        discountPrice: { type: Number, default: null },
        images: [{ type: String, required: true }],
        stock: { type: Number, default: 3, min: 0 },
        variants: [variantSchema],
        specs: { type: specsSchema, default: () => ({}) },
        isFeatured: { type: Boolean, default: false },
        isNewArrival: { type: Boolean, default: false },
        ratings: {
            average: { type: Number, default: 0, min: 0, max: 5 },
            count: { type: Number, default: 0, min: 0 }
        },
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false }
    },
    { timestamps: true }
);

productSchema.index({ name: "text", brandName: "text", modelNumber: "text" });
productSchema.index({ createdAt: -1 });

export default mongoose.model("Product", productSchema);
