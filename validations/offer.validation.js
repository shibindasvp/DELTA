

export const validateOffer = (data = {}, { isUpdate = false } = {}) => {
    const errors = {};

    const name = data.name !== undefined && data.name !== null ? String(data.name).trim() : "";
    if (!isUpdate || data.name !== undefined) {
        if (!name) {
            errors.name = "Offer campaign title is mandatory.";
        } else if (name.length < 3) {
            errors.name = "Offer title must be at least 3 characters.";
        } else if (name.length > 100) {
            errors.name = "Offer title cannot exceed 100 characters.";
        }
    }

    const offerType = data.offerType !== undefined && data.offerType !== null ? String(data.offerType).trim() : "";
    if (!isUpdate || data.offerType !== undefined) {
        if (!offerType || !["product", "brand"].includes(offerType)) {
            errors.offerType = "Valid offer type is required (product or brand).";
        }
    }

    const scope = offerType || (data.brandId ? "brand" : "product");

    if (scope === "product") {
        const productId = data.productId !== undefined && data.productId !== null ? String(data.productId).trim() : "";
        if (!isUpdate || data.productId !== undefined) {
            if (!productId) {
                errors.productId = "Please choose a target timepiece from the vault catalog.";
            }
        }
    }

    if (scope === "brand") {
        const brandId = data.brandId !== undefined && data.brandId !== null ? String(data.brandId).trim() : "";
        if (!isUpdate || data.brandId !== undefined) {
            if (!brandId) {
                errors.brandId = "Please choose a target Maison brand for this brand offer.";
            }
        }
    }

    if (!isUpdate || data.discountPercentage !== undefined) {
        const rawDiscount = data.discountPercentage;
        if (rawDiscount === undefined || rawDiscount === null || String(rawDiscount).trim() === "") {
            errors.discountPercentage = "Discount percentage is mandatory.";
        } else {
            const discountNum = Number(rawDiscount);
            if (isNaN(discountNum) || discountNum <= 0) {
                errors.discountPercentage = "Discount must be a positive number greater than 0.";
            } else if (discountNum < 1) {
                errors.discountPercentage = "Discount percentage must be at least 1%.";
            } else if (discountNum >= 80) {
                errors.discountPercentage = "Discount percentage must be less than 80% (cannot be 80% or greater).";
            }
        }
    }

    let startDateObj = null;
    if (!isUpdate || data.startDate !== undefined) {
        const rawStartDate = data.startDate !== undefined && data.startDate !== null ? String(data.startDate).trim() : "";
        if (!rawStartDate) {
            errors.startDate = "Start date is mandatory.";
        } else {
            startDateObj = new Date(rawStartDate);
            if (isNaN(startDateObj.getTime())) {
                errors.startDate = "Invalid promotional start date.";
            }
        }
    }

    if (!isUpdate || data.endDate !== undefined) {
        const rawEndDate = data.endDate !== undefined && data.endDate !== null ? String(data.endDate).trim() : "";
        if (!rawEndDate) {
            errors.endDate = "Expiration date is mandatory.";
        } else {
            const endDateObj = new Date(rawEndDate);
            if (isNaN(endDateObj.getTime())) {
                errors.endDate = "Invalid promotional expiration date.";
            } else if (startDateObj && !isNaN(startDateObj.getTime()) && endDateObj <= startDateObj) {
                errors.endDate = "Expiration date must be later than the promotional start date.";
            }
        }
    }

    if (data.description !== undefined && data.description !== null) {
        const desc = String(data.description).trim();
        if (desc.length > 500) {
            errors.description = "Description cannot exceed 500 characters.";
        }
    }

    return errors;
};
