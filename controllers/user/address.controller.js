import {
    getAddresses,
    getAddressById,
    addAddress,
    editAddress,
    removeAddress,
    setDefaultAddress
} from "../../services/user/address.service.js";

import {
    validateAddress
} from "../../validations/address.validation.js";

import {
    lookupPincode
} from "../../helpers/pincode.helper.js";
import { formatErrorMessage, isAjaxRequest, normalizeError, respondWithError } from "../../utils/error.js";

export const showAddresses = async (req, res, next) => {
    try {
        const userId = req.user._id || req.user.userId;
        const addresses = await getAddresses(userId);

        if (req.xhr || req.headers.accept?.includes("json") || req.query.ajax === "true") {
            return res.json({ success: true, addresses });
        }

        let success = null;
        let error = null;

        if (req.query.added === "true") {
            success = "New address added successfully.";
        }

        if (req.query.updated === "true") {
            success = "Address updated successfully.";
        }

        if (req.query.deleted === "true") {
            success = "Address deleted successfully.";
        }

        if (req.query.success) {
            success = req.query.success;
        }

        if (req.query.error) {
            error = req.query.error;
        }

        return res.render("user/profile/addresses", {
            addresses,
            success,
            error,
            user: req.user || res.locals.currentUser
        });
    } catch (error) {
        if (isAjaxRequest(req)) {
            const { statusCode, message } = normalizeError(error, "Unable to load saved addresses.");
            return res.status(statusCode).json({ success: false, message });
        }
        next(error);
    }
};

export const showAddAddress = (req, res) => {
    res.render("user/profile/add-address", {
        address: {},
        errors: {},
        error: null,
        user: req.user || res.locals.currentUser
    });
};

export const addNewAddress = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const errors = validateAddress(req.body);

        if (Object.keys(errors).length > 0) {
            if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
                return res.status(400).json({
                    success: false,
                    errors,
                    message: Object.values(errors)[0] || "Invalid address details provided."
                });
            }
            return res.status(400).render("user/profile/add-address", {
                address: req.body,
                errors,
                error: null,
                user: req.user || res.locals.currentUser
            });
        }

        const newAddress = await addAddress(userId, req.body);

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: "New address added successfully.",
                address: newAddress
            });
        }

        const redirectUrl = req.body.redirect || req.query.redirect || "/profile/addresses?added=true";
        return res.redirect(redirectUrl);
    } catch (error) {
        const { statusCode, message, errors } = normalizeError(error, "Failed to save address. Please review your entries and try again.", 400);
        if (isAjaxRequest(req) || req.is("json")) {
            return res.status(statusCode).json({
                success: false,
                message,
                ...(errors ? { errors } : {})
            });
        }
        return res.status(statusCode).render("user/profile/add-address", {
            address: req.body,
            errors: errors || {},
            error: message,
            user: req.user || res.locals.currentUser
        });
    }
};

export const showEditAddress = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const address = await getAddressById(req.params.id, userId);

        if (req.xhr || req.headers.accept?.includes("json")) {
            return res.json({ success: true, address });
        }

        return res.render("user/profile/edit-address", {
            address,
            errors: {},
            error: null,
            user: req.user || res.locals.currentUser
        });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Address not found or you do not have access to it.", 404);
        if (isAjaxRequest(req)) {
            return res.status(statusCode).json({ success: false, message });
        }
        return res.status(statusCode === 500 ? 500 : 404).render(statusCode === 500 ? "errors/500" : "errors/404", {
            statusCode,
            url: req.originalUrl,
            message
        });
    }
};

export const updateExistingAddress = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const errors = validateAddress(req.body);

        if (Object.keys(errors).length > 0) {
            if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
                return res.status(400).json({
                    success: false,
                    errors,
                    message: Object.values(errors)[0] || "Invalid address details."
                });
            }
            return res.status(400).render("user/profile/edit-address", {
                address: {
                    ...req.body,
                    _id: req.params.id
                },
                errors,
                error: null,
                user: req.user || res.locals.currentUser
            });
        }

        const updatedAddress = await editAddress(userId, req.params.id, req.body);

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: "Address updated successfully.",
                address: updatedAddress
            });
        }

        const redirectUrl = req.body.redirect || req.query.redirect || "/profile/addresses?updated=true";
        return res.redirect(redirectUrl);
    } catch (error) {
        const { statusCode, message, errors } = normalizeError(error, "Failed to update address. Please verify your entries and try again.", 400);
        if (isAjaxRequest(req) || req.is("json")) {
            return res.status(statusCode).json({
                success: false,
                message,
                ...(errors ? { errors } : {})
            });
        }
        return res.status(statusCode).render("user/profile/edit-address", {
            address: {
                ...req.body,
                _id: req.params.id
            },
            errors: errors || {},
            error: message,
            user: req.user || res.locals.currentUser
        });
    }
};

export const deleteExistingAddress = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        await removeAddress(userId, req.params.id);

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: "Address deleted successfully."
            });
        }

        return res.redirect("/profile/addresses?deleted=true");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to delete address.",
            redirectUrl: "/profile/addresses"
        });
    }
};

export const setDefaultAddressHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const updated = await setDefaultAddress(userId, req.params.id);

        if (req.xhr || req.headers.accept?.includes("json") || req.is("json")) {
            return res.json({
                success: true,
                message: "Primary delivery address updated.",
                address: updated
            });
        }

        return res.redirect(req.headers.referer || "/profile/addresses?updated=true");
    } catch (error) {
        return respondWithError(req, res, error, {
            fallback: "Failed to set primary delivery address.",
            redirectUrl: req.headers.referer || "/profile/addresses"
        });
    }
};

export const getPincodeDetails = async (req, res) => {
    try {
        const { pincode } = req.params;
        const result = await lookupPincode(pincode);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: formatErrorMessage(error, "Unable to verify pincode right now. Please enter city and state manually.")
        });
    }
};