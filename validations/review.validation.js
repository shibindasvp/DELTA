/**
 * Review Validation Module
 * Validates ratings, review headline, and detailed comment.
 */

export const validateReview = (data = {}) => {
    const errors = {};

    const rawRating = data.rating;
    if (rawRating === undefined || rawRating === null || String(rawRating).trim() === "") {
        errors.rating = "Please select a star rating from 1 to 5.";
    } else {
        const ratingNum = Number(rawRating);
        if (isNaN(ratingNum) || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            errors.rating = "Rating must be a whole number between 1 and 5 stars.";
        }
    }

    if (data.title !== undefined && data.title !== null) {
        const title = String(data.title).trim();
        if (title.length > 100) {
            errors.title = "Review headline cannot exceed 100 characters.";
        }
    }

    const comment = data.comment !== undefined && data.comment !== null ? String(data.comment).trim() : "";
    if (!comment) {
        errors.comment = "Please write a review comment.";
    } else if (comment.length < 4) {
        errors.comment = "Review comment must be at least 4 characters.";
    } else if (comment.length > 1000) {
        errors.comment = "Review comment cannot exceed 1000 characters.";
    }

    return errors;
};
