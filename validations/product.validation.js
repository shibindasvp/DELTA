import {
    PRODUCT_NAME_REGEX,
    MODEL_NUMBER_REGEX,
    PRICE_REGEX,
    INTEGER_REGEX,
    HEX_COLOR_REGEX,
    VARIANT_TEXT_REGEX
} from "../utils/constants.js";

const MAX_PRODUCT_PRICE = 200000000;

export const validateProduct = (data = {}, totalImageCount = 0) => {
    const errors = {};
    const name = String(data.name || "").trim();
    const brand = String(data.brand || "").trim();
    const modelNumber = String(data.modelNumber || "").trim();
    const globalPriceStr = String(data.price || "").trim();
    const globalStockStr = String(data.stock || "").trim();

    if (!name) {
        errors.name = "Timepiece model name is required.";
    } else if (name.length < 3 || name.length > 120) {
        errors.name = "Model name must be between 3 and 120 characters.";
    } else if (!PRODUCT_NAME_REGEX.test(name)) {
        errors.name = "Model name contains invalid characters. Use letters, numbers, and standard punctuation.";
    }

    if (!brand) {
        errors.brand = "Please select a Manufacture Maison / Brand.";
    }

    if (modelNumber && !MODEL_NUMBER_REGEX.test(modelNumber)) {
        errors.modelNumber = "Reference number format is invalid. Use letters, numbers, hyphens or dots.";
    }

  
    let variants = [];
    const rawVariants = data.variantsJson !== undefined ? data.variantsJson : data.variants;
    if (rawVariants) {
        try {
            variants = typeof rawVariants === "string" ? JSON.parse(rawVariants) : rawVariants;
        } catch (e) {
            errors.variants = "Invalid variants format provided.";
        }
    }

    if (!Array.isArray(variants) || variants.length === 0) {
        if (!globalPriceStr || !PRICE_REGEX.test(globalPriceStr) || Number(globalPriceStr) <= 0) {
            errors.price = "Price must be a valid positive amount greater than ₹0.";
        } else if (Number(globalPriceStr) > MAX_PRODUCT_PRICE) {
            errors.price = "Price cannot exceed ₹20,00,00,000 (20 Crores).";
        }
        if (!globalStockStr || !INTEGER_REGEX.test(globalStockStr) || Number(globalStockStr) < 0) {
            errors.stock = "Stock quantity must be a non-negative integer.";
        }
        if (totalImageCount < 3) {
            errors.images = `A minimum of 3 timepiece images is required (currently ${totalImageCount}).`;
        } else if (totalImageCount > 6) {
            errors.images = `A maximum of 6 timepiece images is allowed (currently ${totalImageCount}).`;
        }
    } else {
        let totalVariantPhotos = 0;
        const seenColors = new Map();
        const seenCombinations = new Map();

        variants.forEach((v, idx) => {
            const vColor = String(v.color || "").trim();
            const vColorCode = String(v.colorCode || "").trim();
            const vMaterial = String(v.material || "").trim();
            const vDial = String(v.dial || "").trim();
            const normalizedColor = vColor.toLowerCase();
            const comboKey = `${normalizedColor}|${vMaterial.toLowerCase()}|${vDial.toLowerCase()}`;

            if (normalizedColor) {
                if (seenColors.has(normalizedColor)) {
                    const firstIdx = seenColors.get(normalizedColor);
                    errors[`variant_${idx}_color`] = `Duplicate edition name: "${vColor}" is identical to Variant #${firstIdx + 1}. Each edition must have a unique color / title.`;
                } else {
                    seenColors.set(normalizedColor, idx);
                }
            }

            if (comboKey && vMaterial && vDial) {
                if (seenCombinations.has(comboKey)) {
                    const firstIdx = seenCombinations.get(comboKey);
                    errors[`variant_${idx}_duplicate`] = `Duplicate variant configuration: Identical to Variant #${firstIdx + 1} (Same Color, Material & Dial).`;
                    if (!errors.variants) {
                        errors.variants = "Duplicate variants detected. Each variant must have unique specifications.";
                    }
                } else {
                    seenCombinations.set(comboKey, idx);
                }
            }
            
            let vPriceStr = String(v.price !== undefined && v.price !== null ? v.price : "").trim();
            if (!vPriceStr && globalPriceStr) vPriceStr = globalPriceStr;

            let vStockStr = String(v.stock !== undefined && v.stock !== null ? v.stock : "").trim();
            if (!vStockStr && globalStockStr) vStockStr = globalStockStr;

            const vImages = Array.isArray(v.images) ? v.images : [];
            totalVariantPhotos += vImages.length;

            if (!vColor || vColor.length < 2 || vColor.length > 80 || !VARIANT_TEXT_REGEX.test(vColor)) {
                errors[`variant_${idx}_color`] = `Variant #${idx + 1} color must be 2-80 valid characters.`;
            }
            if (vColorCode && !HEX_COLOR_REGEX.test(vColorCode)) {
                errors[`variant_${idx}_colorCode`] = `Variant #${idx + 1} color code must be a valid hex code (e.g. #C0C0C0).`;
            }
            if (!vMaterial || vMaterial.length < 2 || vMaterial.length > 150 || !VARIANT_TEXT_REGEX.test(vMaterial)) {
                errors[`variant_${idx}_material`] = `Variant #${idx + 1} material must be 2-150 valid characters.`;
            }
            if (!vDial || vDial.length < 2 || vDial.length > 150 || !VARIANT_TEXT_REGEX.test(vDial)) {
                errors[`variant_${idx}_dial`] = `Variant #${idx + 1} dial finish must be 2-150 valid characters.`;
            }
            
            if (!vPriceStr || !PRICE_REGEX.test(vPriceStr) || Number(vPriceStr) <= 0) {
                errors[`variant_${idx}_price`] = `Variant #${idx + 1} price must be a valid positive amount.`;
            } else if (Number(vPriceStr) > MAX_PRODUCT_PRICE) {
                errors[`variant_${idx}_price`] = `Variant #${idx + 1} price cannot exceed ₹20,00,00,000 (20 Crores).`;
            }

            if (!vStockStr || !INTEGER_REGEX.test(vStockStr) || Number(vStockStr) < 0) {
                errors[`variant_${idx}_stock`] = `Variant #${idx + 1} stock must be a non-negative integer.`;
            }
        });

        const overallImages = totalVariantPhotos + totalImageCount;
        if (overallImages < 3 && (!data.retainedImages || data.retainedImages.length < 3)) {
            errors.images = `A minimum of 3 timepiece images is required across your editions (currently ${overallImages}).`;
        } else if (overallImages > 6) {
            errors.images = `A maximum of 6 timepiece images is allowed across editions (currently ${overallImages}).`;
        }
    }

    return errors;
};
