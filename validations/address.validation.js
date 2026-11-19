import {
    NAME_REGEX,
    PHONE_REGEX,
    PINCODE_REGEX,
    CITY_STATE_COUNTRY_REGEX,
    ADDRESS_LINE_REGEX
} from "../utils/constants.js";

export const validateAddress = (data = {}) => {
    const errors = {};

    const fullName = String(
        data.fullName || data.name || ""
    ).trim();

    const phone = String(
        data.phone || ""
    ).trim();

    const addressLine = String(
        data.addressLine || data.address || ""
    ).trim();

    const city = String(
        data.city || ""
    ).trim();

    const state = String(
        data.state || ""
    ).trim();

    const pincode = String(
        data.pincode || ""
    ).trim();

    if (!fullName) {
        errors.fullName = "Full name is required.";
    } else if (!NAME_REGEX.test(fullName)) {
        errors.fullName =
            "Enter a valid name containing only letters and spaces.";
    }

    if (!phone) {
        errors.phone = "Phone number is required.";
    } else if (!PHONE_REGEX.test(phone)) {
        errors.phone = "Enter a valid 10-digit Indian phone number.";
    }

    if (!addressLine) {
        errors.addressLine = "Address is required.";
    } else if (!ADDRESS_LINE_REGEX.test(addressLine)) {
        errors.addressLine = "Enter a valid address.";
    }

    if (!city) {
        errors.city = "City is required.";
    } else if (!CITY_STATE_COUNTRY_REGEX.test(city)) {
        errors.city = "Enter a valid city.";
    }

    if (!state) {
        errors.state = "State is required.";
    } else if (!CITY_STATE_COUNTRY_REGEX.test(state)) {
        errors.state = "Enter a valid state.";
    }

    if (!pincode) {
        errors.pincode = "Pincode is required.";
    } else if (!PINCODE_REGEX.test(pincode)) {
        errors.pincode = "Enter a valid 6-digit pincode.";
    }

    return errors;
};