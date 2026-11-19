import {
    BRAND_NAME_REGEX,
    BRAND_ORIGIN_REGEX,
    URL_REGEX,
    INTEGER_REGEX
} from "../utils/constants.js";

export const validateBrand = (data = {}) => {
    const errors = {};
    const name = String(data.name || "").trim();
    const origin = String(data.origin || "").trim();
    const description = String(data.description || "").trim();
    const foundedYearStr = data.foundedYear !== undefined && data.foundedYear !== null ? String(data.foundedYear).trim() : "";
    const website = String(data.website || "").trim();

  
    if (!name) {
        errors.name = "Maison / Brand name is required.";
    } else if (name.length < 2 || name.length > 60) {
        errors.name = "Maison name must be between 2 and 60 characters.";
    } else if (!BRAND_NAME_REGEX.test(name)) {
        errors.name = "Maison name contains invalid characters. Use letters, numbers, and standard punctuation.";
    }

  
    if (origin) {
        if (origin.length < 2 || origin.length > 100) {
            errors.origin = "Origin region must be between 2 and 100 characters.";
        } else if (!BRAND_ORIGIN_REGEX.test(origin)) {
            errors.origin = "Origin region contains invalid characters.";
        }
    }

   
    if (foundedYearStr) {
        const currentYear = new Date().getFullYear();
        if (!INTEGER_REGEX.test(foundedYearStr)) {
            errors.foundedYear = "Founded year must be a valid integer year.";
        } else {
            const yearNum = Number(foundedYearStr);
            if (yearNum < 1500 || yearNum > currentYear) {
                errors.foundedYear = `Founded year must be between 1500 and ${currentYear}.`;
            }
        }
    }

 
    if (description && description.length > 1000) {
        errors.description = "Heritage notes cannot exceed 1000 characters.";
    }

   
    if (website) {
        if (website.length > 200) {
            errors.website = "Website URL cannot exceed 200 characters.";
        } else if (!URL_REGEX.test(website)) {
            errors.website = "Please enter a valid website URL (e.g. https://www.rolex.com).";
        }
    }

    return errors;
};
