import mongoose from "mongoose";
import Review from "../../models/review.model.js";
import Product from "../../models/product.model.js";
import User from "../../models/user.model.js";
import { updateProductRatings } from "../user/review.service.js";
import { getPaginationData } from "../../utils/pagination.js";


export const ensureSampleReviewsExist = async () => {
    try {
        const count = await Review.countDocuments();
        if (count > 0) return;

        const products = await Product.find({ isDeleted: false, isActive: true }).limit(6);
        if (!products || products.length === 0) return;

        const sampleCollectors = [
            { name: "Arthur Vance", email: "arthur.vance@horology.ch", phone: "9876543101" },
            { name: "Rajesh Malhotra", email: "rajesh.malhotra@collector.in", phone: "9876543102" },
            { name: "Evelyn Sinclair", email: "evelyn.sinclair@mayfair.co.uk", phone: "9876543103" },
            { name: "Vikramaditya Singhania", email: "vikram.singh@heritage.in", phone: "9876543104" }
        ];

        const collectorUsers = [];
        for (const col of sampleCollectors) {
            let user = await User.findOne({ email: col.email });
            if (!user) {
                user = await User.create({
                    name: col.name,
                    email: col.email,
                    phone: col.phone,
                    isVerified: true
                });
            }
            collectorUsers.push(user);
        }

        const sampleReviewsData = [
            {
                prodIdx: 0,
                user: collectorUsers[0]._id,
                rating: 5,
                title: "Superlative finish and dial symmetry",
                comment: "The platinum weight and sunburst dial are majestic in person. The movement keeps exceptional chronometric precision. Arrived securely within 48 hours via white-glove courier.",
                isVerifiedPurchase: true,
                isActive: true
            },
            {
                prodIdx: 0,
                user: collectorUsers[1]._id,
                rating: 5,
                title: "A true centerpiece in my private vault",
                comment: "The authentication documents, warranty dossier, and presentation box made the unboxing unforgettable. Flawless micro-engineering and exquisite wrist ergonomics.",
                isVerifiedPurchase: true,
                isActive: true
            },
            {
                prodIdx: 1 % products.length,
                user: collectorUsers[2]._id,
                rating: 5,
                title: "Iconic horology and magnificent presence",
                comment: "The hand-finished beveling and Côtes de Genève stripes on the movement are breathtaking through the exhibition sapphire back. Worth every single rupee.",
                isVerifiedPurchase: false,
                isActive: true
            },
            {
                prodIdx: 1 % products.length,
                user: collectorUsers[3]._id,
                rating: 4,
                title: "Exemplary craftsmanship, understated luxury",
                comment: "Solid casing with scratch-resistant sapphire crystal. Wears slightly heavier than expected on small wrists, but the balance and clasp security are unmatched.",
                isVerifiedPurchase: true,
                isActive: true
            },
            {
                prodIdx: 2 % products.length,
                user: collectorUsers[0]._id,
                rating: 5,
                title: "Unrivaled tourbillon execution and precision",
                comment: "Having collected high complications for over two decades, this timepiece stands comfortably alongside the finest Geneva manufactures. Superlative service.",
                isVerifiedPurchase: true,
                isActive: true
            },
            {
                prodIdx: 3 % products.length,
                user: collectorUsers[1]._id,
                rating: 5,
                title: "Masterpiece in Oystersteel and guilloche dial",
                comment: "The guilloche dial catches the light with remarkable depth. Power reserve tested to full duration with zero deviation. A superlative acquisition.",
                isVerifiedPurchase: true,
                isActive: true
            }
        ];

        for (const data of sampleReviewsData) {
            const targetProduct = products[data.prodIdx];
            if (!targetProduct) continue;

            const existing = await Review.findOne({ product: targetProduct._id, user: data.user });
            if (!existing) {
                await Review.create({
                    product: targetProduct._id,
                    user: data.user,
                    rating: data.rating,
                    title: data.title,
                    comment: data.comment,
                    isVerifiedPurchase: data.isVerifiedPurchase,
                    isActive: data.isActive
                });
                await updateProductRatings(targetProduct._id);
            }
        }
    } catch (err) {
        console.error("Error seeding sample reviews:", err);
    }
};


export const getAdminReviewsList = async ({
    search = "",
    rating = "all",
    status = "all",
    verified = "all",
    sort = "newest",
    page = 1,
    limit = 10
} = {}) => {
    await ensureSampleReviewsExist();

    const query = {};

    if (rating !== "all" && rating !== "") {
        const rNum = parseInt(rating, 10);
        if (!isNaN(rNum) && rNum >= 1 && rNum <= 5) {
            query.rating = rNum;
        }
    }

    if (status === "active") {
        query.isActive = true;
    } else if (status === "inactive" || status === "hidden") {
        query.isActive = false;
    }

    if (verified === "verified" || verified === "true") {
        query.isVerifiedPurchase = true;
    } else if (verified === "unverified" || verified === "false") {
        query.isVerifiedPurchase = false;
    }

    if (search && search.trim() !== "") {
        const s = search.trim();
        const regex = new RegExp(s, "i");

        const [matchedProducts, matchedUsers] = await Promise.all([
            Product.find({
                $or: [{ name: regex }, { modelNumber: regex }, { brandName: regex }]
            }).select("_id"),
            User.find({
                $or: [{ name: regex }, { email: regex }]
            }).select("_id")
        ]);

        const prodIds = matchedProducts.map(p => p._id);
        const userIds = matchedUsers.map(u => u._id);

        query.$or = [
            { title: regex },
            { comment: regex },
            ...(prodIds.length > 0 ? [{ product: { $in: prodIds } }] : []),
            ...(userIds.length > 0 ? [{ user: { $in: userIds } }] : [])
        ];
    }

    let sortOptions = { createdAt: -1 };
    if (sort === "oldest") {
        sortOptions = { createdAt: 1 };
    } else if (sort === "rating-high") {
        sortOptions = { rating: -1, createdAt: -1 };
    } else if (sort === "rating-low") {
        sortOptions = { rating: 1, createdAt: -1 };
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * pageLimit;

    const [reviews, totalItems, allStats] = await Promise.all([
        Review.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(pageLimit)
            .populate({
                path: "product",
                select: "name slug brand brandName modelNumber images price discountPrice isActive isDeleted"
            })
            .populate({
                path: "user",
                select: "name email phone profileImage"
            })
            .lean(),
        Review.countDocuments(query),
        Review.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: { $sum: { $cond: ["$isActive", 1, 0] } },
                    hidden: { $sum: { $cond: ["$isActive", 0, 1] } },
                    fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
                    verified: { $sum: { $cond: ["$isVerifiedPurchase", 1, 0] } },
                    avgRating: { $avg: "$rating" }
                }
            }
        ])
    ]);

    const statsGroup = allStats[0] || {};
    const stats = {
        totalReviews: statsGroup.total || 0,
        activeReviews: statsGroup.active || 0,
        hiddenReviews: statsGroup.hidden || 0,
        fiveStarCount: statsGroup.fiveStars || 0,
        verifiedCount: statsGroup.verified || 0,
        averageRating: statsGroup.avgRating ? Number(statsGroup.avgRating.toFixed(1)) : 0
    };

    const pagination = getPaginationData({
        page: currentPage,
        limit: pageLimit,
        totalItems
    });

    return {
        reviews,
        stats,
        pagination
    };
};


export const getReviewById = async (id) => {
    return await Review.findById(id)
        .populate({
            path: "product",
            select: "name slug brand brandName modelNumber images price discountPrice"
        })
        .populate({
            path: "user",
            select: "name email phone profileImage"
        });
};


export const toggleReviewStatus = async (id) => {
    const review = await Review.findById(id);
    if (!review) {
        throw new Error("Review not found.");
    }

    review.isActive = !review.isActive;
    await review.save();

    await updateProductRatings(review.product);
    return review;
};


export const deleteReviewAdmin = async (id) => {
    const review = await Review.findById(id);
    if (!review) {
        throw new Error("Review not found.");
    }

    const productId = review.product;
    await Review.findByIdAndDelete(id);

    await updateProductRatings(productId);
    return review;
};
