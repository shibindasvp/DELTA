import {
    getOrCreateWallet,
    getWalletBalance,
    getWalletDetails,
    initiateAddMoneyToWallet,
    verifyAndCompleteAddMoneyToWallet
} from "../../services/user/wallet.service.js";
import { normalizeError } from "../../utils/error.js";


export const showWallet = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { page = 1, type = "" } = req.query;

        const {
            wallet,
            transactions,
            stats,
            pagination
        } = await getWalletDetails({
            userId,
            page: parseInt(page, 10) || 1,
            limit: 10,
            type: type.trim()
        });

        res.render("user/wallet/index", {
            wallet,
            transactions,
            stats,
            pagination,
            selectedType: type.trim(),
            user: req.user,
            title: "DELTA Vault Wallet & Reserve — Portfolio"
        });
    } catch (error) {
        console.error("Wallet dashboard render error:", error);
        next(error);
    }
};


export const getWalletBalanceApi = async (req, res) => {
    try {
        const userId = req.user._id;
        const balance = await getWalletBalance(userId);
        res.json({ success: true, balance });
    } catch (error) {
        const { statusCode, message } = normalizeError(error, "Unable to fetch wallet balance.");
        res.status(statusCode).json({ success: false, message, balance: 0 });
    }
};

export const initiateAddMoneyHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { amount } = req.body;
        const result = await initiateAddMoneyToWallet({ userId, amount });
        res.json(result);
    } catch (error) {
        console.error("Wallet initiate deposit error:", error);
        const { statusCode, message } = normalizeError(error, "Failed to initiate wallet deposit. Please try again.", 400);
        res.status(statusCode).json({ success: false, message });
    }
};

export const verifyAddMoneyHandler = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const {
            amount,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const result = await verifyAndCompleteAddMoneyToWallet({
            userId,
            amount,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        });
        res.json(result);
    } catch (error) {
        console.error("Wallet verify deposit error:", error);
        const { statusCode, message } = normalizeError(error, "Failed to verify deposit signature. If money was debited, it will be reconciled shortly.", 400);
        res.status(statusCode).json({ success: false, message });
    }
};
