import mongoose from "mongoose";

import {
    NAME_REGEX,
    PHONE_REGEX,
    PINCODE_REGEX,
    ADDRESS_LINE_REGEX,
    CITY_STATE_COUNTRY_REGEX
} from "../utils/constants.js";

const addressSchema =
    new mongoose.Schema(
        {
            userId: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
                index: true
            },

            fullName: {
                type: String,
                required: [
                    true,
                    "Full name is required"
                ],
                trim: true,
                match: [
                    NAME_REGEX,
                    "Please enter a valid name"
                ]
            },

            phone: {
                type: String,
                required: true,
                trim: true,
                match: [
                    PHONE_REGEX,
                    "Please enter a valid phone number"
                ]
            },

            addressLine: {
                type: String,
                required: true,
                trim: true,
                match: [
                    ADDRESS_LINE_REGEX,
                    "Please enter a valid address"
                ]
            },

            city: {
                type: String,
                required: true,
                trim: true,
                match: [
                    CITY_STATE_COUNTRY_REGEX,
                    "Please enter a valid city"
                ]
            },

            state: {
                type: String,
                required: true,
                trim: true,
                match: [
                    CITY_STATE_COUNTRY_REGEX,
                    "Please enter a valid state"
                ]
            },

            pincode: {
                type: String,
                required: true,
                trim: true,
                match: [
                    PINCODE_REGEX,
                    "Please enter a valid pincode"
                ]
            },

            country: {
                type: String,
                default: "India",
                trim: true
            },

            addressType: {
                type: String,
                enum: [
                    "home",
                    "work",
                    "other"
                ],
                default: "home"
            },

            isDefault: {
                type: Boolean,
                default: false
            }
        },
        {
            timestamps: true
        }
    );

addressSchema.index({
    userId: 1,
    isDefault: 1
});

const Address =
    mongoose.model(
        "Address",
        addressSchema
    );

export default Address;