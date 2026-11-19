import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: [true, "Product reference is required."],
            index: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Review author is required."],
            index: true
        },
        rating: {
            type: Number,
            required: [true, "Rating is required."],
            min: [1, "Rating must be between 1 and 5 stars."],
            max: [5, "Rating must be between 1 and 5 stars."]
        },
        title: {
            type: String,
            trim: true,
            maxlength: [100, "Review headline cannot exceed 100 characters."],
            default: ""
        },
        comment: {
            type: String,
            required: [true, "Review comment is required."],
            trim: true,
            minlength: [4, "Review comment must be at least 4 characters."],
            maxlength: [1000, "Review comment cannot exceed 1000 characters."]
        },
        isVerifiedPurchase: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

// One review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);
export default Review;
