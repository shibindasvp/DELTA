export class AppError extends Error {
    constructor(message, statusCode = 400, errors = null, code = null) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.status = statusCode;
        this.errors = errors;
        this.code = code;
        this.isOperational = true;
    }
}

export const isAjaxRequest = (req) => {
    if (!req) return false;
    const accept = req.headers?.accept || "";
    const contentType = req.headers?.["content-type"] || "";
    return Boolean(
        req.xhr ||
        req.headers?.["x-requested-with"] === "XMLHttpRequest" ||
        req.originalUrl?.startsWith("/api") ||
        req.query?.ajax === "true" ||
        accept.includes("application/json") ||
        (accept.includes("json") && !accept.includes("text/html")) ||
        (req.method !== "GET" && contentType.includes("application/json"))
    );
};

const FIELD_LABELS = {
    _id: "record ID",
    email: "email address",
    phone: "phone number",
    modelNumber: "model number",
    sku: "SKU",
    slug: "name or URL slug",
    code: "code",
    name: "name",
    password: "password"
};

export const formatFieldName = (field = "") => {
    const clean = String(field).split(".").pop() || "";
    if (!clean) return "field";
    if (FIELD_LABELS[clean]) return FIELD_LABELS[clean];
    return clean
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]+/g, " ")
        .trim()
        .toLowerCase();
};

const capitalize = (text = "") =>
    text ? text.charAt(0).toUpperCase() + text.slice(1) : "";

const cleanMongooseValidatorMessage = (field, rawMsg = "") => {
    const label = capitalize(formatFieldName(field));
    if (!rawMsg) return `${label} is invalid.`;

    if (/^Path `.+` is required\.?$/i.test(rawMsg)) {
        return `${label} is required.`;
    }
    const minMatch = rawMsg.match(/less than minimum allowed value \(([^)]+)\)/i);
    if (minMatch) {
        return `${label} must be at least ${minMatch[1]}.`;
    }
    const maxMatch = rawMsg.match(/more than maximum allowed value \(([^)]+)\)/i);
    if (maxMatch) {
        return `${label} cannot exceed ${maxMatch[1]}.`;
    }
    const minLenMatch = rawMsg.match(/shorter than the minimum allowed length \((\d+)\)/i);
    if (minLenMatch) {
        return `${label} must be at least ${minLenMatch[1]} characters long.`;
    }
    const maxLenMatch = rawMsg.match(/longer than the maximum allowed length \((\d+)\)/i);
    if (maxLenMatch) {
        return `${label} cannot exceed ${maxLenMatch[1]} characters.`;
    }
    if (/is not a valid enum value/i.test(rawMsg)) {
        return `Please select a valid option for ${formatFieldName(field)}.`;
    }
    if (/^Cast to /i.test(rawMsg)) {
        return `Invalid format provided for ${formatFieldName(field)}.`;
    }
    return rawMsg;
};

const INTERNAL_RUNTIME_ERROR_PATTERN =
    /Cannot read propert|Cannot set propert|Cannot destructure|is not a function|is not defined|Assignment to constant|E11000 duplicate key|Cast to ObjectId failed|buffering timed out|topology was destroyed|server selection timed out/i;

const IMAGE_ERROR_PATTERN =
    /unsupported image format|Input file contains|Vips|Input buffer|premature end of JPEG|corrupt/i;

const NETWORK_CODES = new Set([
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNRESET"
]);

export const normalizeError = (
    error,
    fallbackMessage = "Something went wrong. Please try again.",
    defaultStatusCode = 500
) => {
    if (!error) {
        return { statusCode: defaultStatusCode, message: fallbackMessage, errors: null };
    }

    if (typeof error === "string") {
        const clean = error.trim();
        return {
            statusCode: defaultStatusCode,
            message: clean && !INTERNAL_RUNTIME_ERROR_PATTERN.test(clean) ? clean : fallbackMessage,
            errors: null
        };
    }

    // 1. Mongoose CastError (invalid ObjectId, Number, Date, etc.)
    if (error.name === "CastError") {
        if (error.path === "_id" || error.kind === "ObjectId") {
            return {
                statusCode: 404,
                message: "The requested item ID is invalid or could not be found.",
                errors: null
            };
        }
        if (error.kind === "Number") {
            return {
                statusCode: 400,
                message: `Please enter a valid number for ${formatFieldName(error.path)}.`,
                errors: null
            };
        }
        if (error.kind === "Date") {
            return {
                statusCode: 400,
                message: `Please enter a valid date for ${formatFieldName(error.path)}.`,
                errors: null
            };
        }
        return {
            statusCode: 400,
            message: `Invalid value provided for ${formatFieldName(error.path)}.`,
            errors: null
        };
    }

    // 2. Mongoose ValidationError
    if (error.name === "ValidationError" && error.errors) {
        const fieldErrors = {};
        let firstMessage = null;
        for (const [field, detail] of Object.entries(error.errors)) {
            const clean = cleanMongooseValidatorMessage(field, detail?.message);
            fieldErrors[field] = clean;
            if (!firstMessage) firstMessage = clean;
        }
        return {
            statusCode: 400,
            message: firstMessage || "Please check the highlighted input fields and try again.",
            errors: fieldErrors
        };
    }

    // 3. MongoDB Duplicate Key Error (E11000 / E11001)
    const dupCode = error.code || error.cause?.code;
    if (dupCode === 11000 || dupCode === 11001) {
        const keySource = error.keyValue || error.keyPattern || error.cause?.keyValue || error.cause?.keyPattern;
        let dupField = keySource ? Object.keys(keySource)[0] : null;
        if (!dupField && error.message) {
            const indexMatch = error.message.match(/index:\s+([a-zA-Z0-9_]+?)(?:_1|_-1|\s)/);
            if (indexMatch) dupField = indexMatch[1];
        }

        const customDuplicateMessages = {
            email: "An account with this email address already exists.",
            phone: "This phone number is already registered.",
            code: "This code is already in use. Please choose a different code.",
            slug: "An item with this name already exists. Please choose a unique name.",
            name: "An item with this name already exists. Please choose a unique name.",
            modelNumber: "A timepiece with this model number already exists.",
            sku: "An item with this SKU already exists."
        };

        const friendlyMsg = dupField && customDuplicateMessages[dupField]
            ? customDuplicateMessages[dupField]
            : `A record with this ${formatFieldName(dupField || "value")} already exists.`;

        return {
            statusCode: 409,
            message: friendlyMsg,
            errors: dupField ? { [dupField]: friendlyMsg } : null
        };
    }

    // 4. Multer Upload Errors
    if (error.name === "MulterError") {
        const multerMessages = {
            LIMIT_FILE_SIZE: "The uploaded file is too large. Please choose a smaller image.",
            LIMIT_FILE_COUNT: "Too many files selected at once. Please upload fewer files.",
            LIMIT_UNEXPECTED_FILE: "Unexpected upload field received. Please check your form and try again.",
            LIMIT_FIELD_VALUE: "Form data exceeded the allowed size limit.",
            LIMIT_PART_COUNT: "Too many form fields submitted in upload request."
        };
        return {
            statusCode: 400,
            message: multerMessages[error.code] || "File upload failed. Please check the file and try again.",
            errors: null
        };
    }

    // 5. Malformed JSON / Request Body Too Large
    if (error instanceof SyntaxError && (error.status === 400 || error.type === "entity.parse.failed")) {
        return {
            statusCode: 400,
            message: "The request contains invalid JSON data. Please check your submission and try again.",
            errors: null
        };
    }
    if (error.type === "entity.too.large" || error.status === 413) {
        return {
            statusCode: 413,
            message: "The submitted request or images are too large to process. Please reduce file sizes and try again.",
            errors: null
        };
    }

    // 6. JWT Session Errors
    if (error.name === "TokenExpiredError") {
        return {
            statusCode: 401,
            message: "Your session has expired. Please sign in again.",
            errors: null
        };
    }
    if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
        return {
            statusCode: 401,
            message: "Your authentication session is invalid. Please sign in again.",
            errors: null
        };
    }

    // 7. Database / External Network Connection Errors
    if (
        error.name === "MongoNetworkError" ||
        error.name === "MongoServerSelectionError" ||
        error.name === "MongoTimeoutError" ||
        error.name === "MongoNotConnectedError" ||
        NETWORK_CODES.has(error.code) ||
        NETWORK_CODES.has(error.cause?.code)
    ) {
        return {
            statusCode: 503,
            message: "A temporary connection issue occurred. Please wait a moment and try again.",
            errors: null
        };
    }

    // 8. Sharp / Image Processing Errors
    const rawMessage = typeof error.message === "string" ? error.message.trim() : "";
    if (IMAGE_ERROR_PATTERN.test(rawMessage)) {
        return {
            statusCode: 400,
            message: "The uploaded file is corrupted or in an unsupported image format. Please use JPG, PNG, or WebP.",
            errors: null
        };
    }

    // 9. Razorpay / Structured Gateway Errors (where error.message is often missing)
    const gatewayDescription = error?.error?.description;
    if (typeof gatewayDescription === "string" && gatewayDescription.trim()) {
        return {
            statusCode: error.statusCode || error.status || 400,
            message: gatewayDescription.trim(),
            errors: error.errors || null
        };
    }

    // 10. Runtime JS bugs (TypeError, ReferenceError, RangeError) -> hide cryptic internals
    if (
        error instanceof TypeError ||
        error instanceof ReferenceError ||
        error instanceof RangeError ||
        INTERNAL_RUNTIME_ERROR_PATTERN.test(rawMessage)
    ) {
        return {
            statusCode: 500,
            message: fallbackMessage,
            errors: null
        };
    }

    // 11. Operational / Domain Errors (explicitly thrown human messages)
    const explicitStatus = error.statusCode || error.status;
    const resolvedStatus = Number.isInteger(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600
        ? explicitStatus
        : defaultStatusCode;

    return {
        statusCode: resolvedStatus,
        message: rawMessage || fallbackMessage,
        errors: error.errors || null
    };
};

export const formatErrorMessage = (
    error,
    fallbackMessage = "Something went wrong. Please try again."
) => normalizeError(error, fallbackMessage, 400).message;

export const respondWithError = (
    req,
    res,
    error,
    {
        fallback = "Something went wrong. Please try again.",
        redirectUrl = null,
        defaultStatus = 400
    } = {}
) => {
    const { statusCode, message, errors } = normalizeError(error, fallback, defaultStatus);
    if (isAjaxRequest(req) || req.is?.("json") || !redirectUrl) {
        const payload = { success: false, message };
        if (errors) payload.errors = errors;
        return res.status(statusCode).json(payload);
    }
    const separator = redirectUrl.includes("?") ? "&" : "?";
    return res.redirect(`${redirectUrl}${separator}error=${encodeURIComponent(message)}`);
};
