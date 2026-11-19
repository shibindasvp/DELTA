import Product from "../../models/product.model.js";
import { addOrUpdateReview, deleteReview } from "../../services/user/review.service.js";
import { isAjaxRequest, respondWithError } from "../../utils/error.js";

export const addReviewHandler = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const product = await Product.findOne({ slug: slug.toLowerCase(), isDeleted: false });

        if (!product) {
            if (isAjaxRequest(req)) {
                return res.status(404).json({ success: false, message: "Timepiece not found." });
            }
            return res.redirect("/shop?error=" + encodeURIComponent("Timepiece not found."));
        }

        const userId = req.user?.userId || req.user?._id;
        if (!userId) {
            if (isAjaxRequest(req)) {
                return res.status(401).json({ success: false, message: "Please sign in to write a review.", redirect: "/login" });
            }
            return res.redirect("/login?redirect=" + encodeURIComponent(`/product/${slug}#reviewsSection`));
        }

        const { rating, title, comment } = req.body;

        const { review, isNew } = await addOrUpdateReview({
            productId: product._id,
            userId,
            rating,
            title,
            comment
        });

        const successMessage = isNew
            ? "Your collector review has been posted successfully."
            : "Your collector review has been updated successfully.";

        if (isAjaxRequest(req)) {
            return res.json({
                success: true,
                message: successMessage,
                review
            });
        }

        return res.redirect(`/product/${slug}?success=${encodeURIComponent(successMessage)}#reviewsSection`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to submit review. Please check your rating and comment.",
            redirectUrl: `/product/${req.params.slug}#reviewsSection`
        });
    }
};

export const deleteReviewHandler = async (req, res, next) => {
    try {
        const { slug, reviewId } = req.params;
        const userId = req.user?.userId || req.user?._id;

        if (!userId) {
            if (isAjaxRequest(req)) {
                return res.status(401).json({ success: false, message: "Please sign in to remove your review.", redirect: "/login" });
            }
            return res.redirect("/login");
        }

        await deleteReview({ reviewId, userId });

        const message = "Your review has been successfully removed.";

        if (isAjaxRequest(req)) {
            return res.json({ success: true, message });
        }

        return res.redirect(`/product/${slug}?success=${encodeURIComponent(message)}#reviewsSection`);
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to remove review.",
            redirectUrl: `/product/${req.params.slug}#reviewsSection`
        });
    }
};
