import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

export const getKeyId = () => process.env.RAZORPAY_KEY_ID || "rzp_test_deltaVault2026";
export const getKeySecret = () => process.env.RAZORPAY_KEY_SECRET || "deltaVaultSecretKey2026";

export const RAZORPAY_KEY_ID = getKeyId();
export const RAZORPAY_KEY_SECRET = getKeySecret();

let razorpayInstance = null;

export const getRazorpayInstance = () => {
    const keyId = getKeyId();
    const keySecret = getKeySecret();
    if (!razorpayInstance || razorpayInstance.key_id !== keyId || razorpayInstance.key_secret !== keySecret) {
        razorpayInstance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });
    }
    return razorpayInstance;
};


export const createRazorpayGatewayOrder = async ({ amount, currency = "INR", receipt, notes = {} }) => {
    const keyId = getKeyId();
    if (!keyId || keyId.includes("deltaVault") || keyId.includes("dummy")) {
        return {
            id: `order_delta_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
            entity: "order",
            amount: Math.round(amount),
            amount_paid: 0,
            amount_due: Math.round(amount),
            currency,
            receipt: receipt || `rcpt_${Date.now().toString(36)}`,
            status: "created",
            attempts: 0,
            notes,
            created_at: Math.floor(Date.now() / 1000),
            isSimulated: true,
            simulatedReason: "Mock development credentials active"
        };
    }

    try {
        const instance = getRazorpayInstance();
        const orderAmount = Math.round(amount);

        const order = await instance.orders.create({
            amount: orderAmount,
            currency,
            receipt: receipt || `rcpt_${Date.now().toString(36)}`,
            notes
        });
        return {
            ...order,
            isSimulated: false
        };
    } catch (err) {
        console.warn("[Razorpay] Notice: Using simulated secure test order (reason: " + (err.message || "Dev sandbox") + ")");
        return {
            id: `order_delta_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
            entity: "order",
            amount: Math.round(amount),
            amount_paid: 0,
            amount_due: Math.round(amount),
            currency,
            receipt: receipt || `rcpt_${Date.now().toString(36)}`,
            status: "created",
            attempts: 0,
            notes,
            created_at: Math.floor(Date.now() / 1000),
            isSimulated: true,
            simulatedReason: err.message || "Dev sandbox"
        };
    }
};


export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
    if (!orderId || !paymentId || !signature) {
        return false;
    }

    const keySecret = getKeySecret();
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(body.toString())
        .digest("hex");

    if (expectedSignature.length !== signature.length) {
        return false;
    }

    try {
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, "utf-8"),
            Buffer.from(signature, "utf-8")
        );
    } catch {
        return false;
    }
};


export const generateTestRazorpaySignature = (orderId, paymentId) => {
    const keySecret = getKeySecret();
    return crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");
};
