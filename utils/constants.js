export const NAME_REGEX =
    /^[A-Za-z][A-Za-z\s.'-]{1,49}$/;

export const EMAIL_REGEX =
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PHONE_REGEX =
    /^[6-9]\d{9}$/;

export const PINCODE_REGEX =
    /^[1-9][0-9]{5}$/;

export const CITY_STATE_COUNTRY_REGEX =
    /^[A-Za-z][A-Za-z .'-]{1,49}$/;

export const ADDRESS_LINE_REGEX =
    /^[A-Za-z0-9\s,.'/#-]{5,200}$/;

export const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,50}$/;

export const PRODUCT_NAME_REGEX =
    /^[A-Za-z0-9][A-Za-z0-9\s\-_'.,()&/+]{2,119}$/;

export const MODEL_NUMBER_REGEX =
    /^[A-Za-z0-9][A-Za-z0-9\-./]{1,49}$/;

export const PRICE_REGEX =
    /^\d+(\.\d{1,2})?$/;

export const INTEGER_REGEX =
    /^\d+$/;

export const HEX_COLOR_REGEX =
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const VARIANT_TEXT_REGEX =
    /^[A-Za-z0-9][A-Za-z0-9\s\-_'"`.,:;()&/+%]{1,149}$/;

export const BRAND_NAME_REGEX =
    /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\-_'.,()&/+]{1,59}$/;

export const BRAND_ORIGIN_REGEX =
    /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s,.'\-\/]{1,99}$/;

export const URL_REGEX =
    /^(https?:\/\/)?(www\.)?[a-zA-Z0-9\-]+(\.[a-zA-Z]{2,})+([\/?#].*)?$/;

export const OTP_REGEX = /^\d{6}$/;

export const OTP_EXPIRY_SECONDS = 300;

export const OTP_EXPIRY_MS =
    OTP_EXPIRY_SECONDS * 1000;

export const LUXURY_BRANDS = [
    {
        name: "Rolex",
        slug: "rolex"
    },
    {
        name: "Patek Philippe",
        slug: "patek-philippe"
    },
    {
        name: "Audemars Piguet",
        slug: "audemars-piguet"
    },
    {
        name: "Omega",
        slug: "omega"
    },
    {
        name: "TAG Heuer",
        slug: "tag-heuer"
    }
];