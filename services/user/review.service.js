import mongoose from "mongoose";
import Review from "../../models/review.model.js";
import Product from "../../models/product.model.js";
import Order from "../../models/order.model.js";
import { validateReview } from "../../validations/review.validation.js";


export const updateProductRatings = async (productId) => {
    try {
        const prodObjId = new mongoose.Types.ObjectId(productId);
        const stats = await Review.aggregate([
            { $match: { product: prodObjId, isActive: true } },
            {
                $group: {
                    _id: "$product",
                    averageRating: { $avg: "$rating" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const avg = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
        const count = stats.length > 0 ? stats[0].count : 0;

        await Product.findByIdAndUpdate(productId, {
            "ratings.average": avg,
            "ratings.count": count
        });

        return { average: avg, count };
    } catch (err) {
        console.error("Error updating product ratings:", err);
        return { average: 0, count: 0 };
    }
};


export const getProductReviews = async (productId, currentUserId = null) => {
    const prodObjId = new mongoose.Types.ObjectId(productId);

    const reviews = await Review.find({
        product: prodObjId,
        isActive: true
    })
        .populate("user", "name email profileImage")
        .sort({ createdAt: -1 })
        .lean();

    const totalReviews = reviews.length;
    const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;

    reviews.forEach((r) => {
        const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
        ratingCounts[star] = (ratingCounts[star] || 0) + 1;
        ratingSum += star;
    });

    const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(1)) : 0;

    const ratingPercentages = {
        5: totalReviews > 0 ? Math.round((ratingCounts[5] / totalReviews) * 100) : 0,
        4: totalReviews > 0 ? Math.round((ratingCounts[4] / totalReviews) * 100) : 0,
        3: totalReviews > 0 ? Math.round((ratingCounts[3] / totalReviews) * 100) : 0,
        2: totalReviews > 0 ? Math.round((ratingCounts[2] / totalReviews) * 100) : 0,
        1: totalReviews > 0 ? Math.round((ratingCounts[1] / totalReviews) * 100) : 0
    };

    let userReview = null;
    let hasPurchased = false;

    if (currentUserId) {
        const uidStr = currentUserId.toString();
        userReview = reviews.find((r) => {
            const authorId = r.user?._id ? r.user._id.toString() : r.user?.toString();
            return authorId === uidStr;
        }) || null;

        const orderMatch = await Order.exists({
            user: currentUserId,
            "items.product": prodObjId,
            "items.status": { $ne: "Cancelled" }
        });
        hasPurchased = Boolean(orderMatch);
    }

    return {
        reviews,
        stats: {
            totalReviews,
            averageRating,
            ratingCounts,
            ratingPercentages
        },
        userReview,
        hasPurchased
    };
};


export const addOrUpdateReview = async ({ productId, userId, rating, title = "", comment = "" }) => {
  
    const errors = validateReview({ rating, title, comment });
    if (Object.keys(errors).length > 0) {
        throw new Error(Object.values(errors)[0]);
    }


    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) {
        throw new Error("Timepiece not found in vault catalog.");
    }

    const hasPurchased = await Order.exists({
        user: userId,
        "items.product": product._id,
        "items.status": { $ne: "Cancelled" }
    });

    let review = await Review.findOne({ product: product._id, user: userId });
    let isNew = false;

    if (!review) {
        isNew = true;
        review = new Review({
            product: product._id,
            user: userId,
            rating: Math.round(Number(rating)),
            title: title ? title.trim() : "",
            comment: comment.trim(),
            isVerifiedPurchase: Boolean(hasPurchased),
            isActive: true
        });
    } else {
        review.rating = Math.round(Number(rating));
        review.title = title ? title.trim() : "";
        review.comment = comment.trim();
        if (hasPurchased) {
            review.isVerifiedPurchase = true;
        }
        review.isActive = true;
    }

    await review.save();
    await updateProductRatings(product._id);

    await review.populate("user", "name email profileImage");

    return {
        review,
        isNew
    };
};


export const deleteReview = async ({ reviewId, userId }) => {
    const review = await Review.findById(reviewId);
    if (!review) {
        throw new Error("Review not found.");
    }

    const reviewAuthorId = review.user?._id ? review.user._id.toString() : review.user?.toString();
    if (reviewAuthorId !== userId.toString()) {
        throw new Error("You are not authorized to delete this review.");
    }

    const productId = review.product;
    await Review.findByIdAndDelete(reviewId);
    await updateProductRatings(productId);

    return { success: true };
};
