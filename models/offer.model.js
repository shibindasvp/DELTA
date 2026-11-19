import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Offer campaign title is mandatory."],
            trim: true,
            minlength: [3, "Offer title must be at least 3 characters."],
            maxlength: [100, "Offer title cannot exceed 100 characters."]
        },
        description: {
            type: String,
            trim: true,
            default: "",
            maxlength: [500, "Description cannot exceed 500 characters."]
        },
        offerType: {
            type: String,
            required: [true, "Valid offer type is required (product or brand)."],
            enum: {
                values: ["product", "brand"],
                message: "Valid offer type is required (product or brand)."
            },
            default: "product"
        },
        discountPercentage: {
            type: Number,
            required: [true, "Discount percentage is mandatory."],
            min: [1, "Discount percentage must be at least 1%."],
            max: [79.99, "Discount percentage must be less than 80% (cannot be 80% or greater)."]
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            default: null
        },
        brand: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Brand",
            default: null
        },
        startDate: {
            type: Date,
            required: [true, "Start date is mandatory."],
            default: Date.now
        },
        endDate: {
            type: Date,
            required: [true, "Expiration date is mandatory."]
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

offerSchema.index({ offerType: 1, isActive: 1, isDeleted: 1 });
offerSchema.index({ product: 1, isActive: 1, isDeleted: 1 });
offerSchema.index({ brand: 1, isActive: 1, isDeleted: 1 });
offerSchema.index({ startDate: 1, endDate: 1 });

const Offer = mongoose.models.Offer || mongoose.model("Offer", offerSchema);
export default Offer;
