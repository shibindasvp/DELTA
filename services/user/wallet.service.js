import Wallet from "../../models/wallet.model.js";
import WalletTransaction from "../../models/walletTransaction.model.js";
import User from "../../models/user.model.js";
import {
    createRazorpayGatewayOrder,
    verifyRazorpaySignature,
    generateTestRazorpaySignature,
    getKeyId,
    RAZORPAY_KEY_ID
} from "../../config/razorpay.js";


export const getOrCreateWallet = async (userId) => {
    if (!userId) {
        throw new Error("Collector identification is required to access vault wallet.");
    }

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
        wallet = await Wallet.create({
            user: userId,
            balance: 0,
            currency: "INR",
            isActive: true
        });
    }
    await User.updateOne(
        { _id: userId },
        { $set: { wallet: wallet._id, walletBalance: wallet.balance } }
    ).catch(() => {});
    return wallet;
};


export const getWalletBalance = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    return wallet.balance;
};


const generateTransactionId = () => {
    const timestampStr = Date.now().toString(36).toUpperCase();
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    return `WTX-${timestampStr}-${randomHex}`;
};


export const creditWallet = async ({
    userId,
    amount,
    purpose = "Refund",
    orderId = null,
    orderNumber = "",
    description = ""
}) => {
    const numericAmount = Math.round(Number(amount));
    if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Credit amount must be greater than zero.");
    }

    const wallet = await Wallet.findOneAndUpdate(
        { user: userId },
        { 
            $inc: { balance: numericAmount },
            $setOnInsert: { currency: "INR", isActive: true }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const transactionId = generateTransactionId();
    const transaction = await WalletTransaction.create({
        wallet: wallet._id,
        user: userId,
        transactionId,
        type: "Credit",
        amount: numericAmount,
        balanceAfter: wallet.balance,
        purpose,
        order: orderId || null,
        orderNumber: orderNumber || "",
        description: description || `Credit of ₹${numericAmount.toLocaleString('en-IN')}`,
        status: "Completed"
    });

    await User.updateOne(
        { _id: userId },
        { $set: { wallet: wallet._id, walletBalance: wallet.balance } }
    ).catch(() => {});

    return { wallet, transaction };
};


export const debitWallet = async ({
    userId,
    amount,
    purpose = "Wallet Payment",
    orderId = null,
    orderNumber = "",
    description = ""
}) => {
    const numericAmount = Math.round(Number(amount));
    if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Debit amount must be greater than zero.");
    }

    const wallet = await Wallet.findOneAndUpdate(
        { user: userId, balance: { $gte: numericAmount } },
        { $inc: { balance: -numericAmount } },
        { new: true }
    );

    if (!wallet) {
        const currentWallet = await Wallet.findOne({ user: userId });
        const currentBal = currentWallet ? currentWallet.balance : 0;
        throw new Error(
            `Insufficient wallet balance. Required: ₹${numericAmount.toLocaleString('en-IN')}, Available: ₹${currentBal.toLocaleString('en-IN')}.`
        );
    }

    const transactionId = generateTransactionId();
    const transaction = await WalletTransaction.create({
        wallet: wallet._id,
        user: userId,
        transactionId,
        type: "Debit",
        amount: numericAmount,
        balanceAfter: wallet.balance,
        purpose,
        order: orderId || null,
        orderNumber: orderNumber || "",
        description: description || `Debit of ₹${numericAmount.toLocaleString('en-IN')}`,
        status: "Completed"
    });

    await User.updateOne(
        { _id: userId },
        { $set: { wallet: wallet._id, walletBalance: wallet.balance } }
    ).catch(() => {});

    return { wallet, transaction };
};


export const getWalletDetails = async ({
    userId,
    page = 1,
    limit = 10,
    type = ""
}) => {
    const wallet = await getOrCreateWallet(userId);

    const query = { user: userId };
    if (type && ["Credit", "Debit"].includes(type)) {
        query.type = type;
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * pageLimit;

    const [transactions, totalCount, statsAgg] = await Promise.all([
        WalletTransaction.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageLimit)
            .lean(),
        WalletTransaction.countDocuments(query),
        WalletTransaction.aggregate([
            { $match: { user: wallet.user } },
            {
                $group: {
                    _id: "$type",
                    totalAmount: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ])
    ]);

    let totalCredits = 0;
    let totalDebits = 0;
    let totalTxCount = 0;

    statsAgg.forEach(stat => {
        if (stat._id === "Credit") totalCredits = stat.totalAmount;
        if (stat._id === "Debit") totalDebits = stat.totalAmount;
        totalTxCount += stat.count;
    });

    const totalPages = Math.ceil(totalCount / pageLimit) || 1;

    return {
        wallet,
        transactions,
        stats: {
            balance: wallet.balance,
            totalCredits,
            totalDebits,
            totalTxCount
        },
        pagination: {
            currentPage,
            totalPages,
            totalCount,
            pageLimit,
            hasPrevPage: currentPage > 1,
            hasNextPage: currentPage < totalPages,
            prevPage: currentPage - 1,
            nextPage: currentPage + 1
        }
    };
};


export const initiateAddMoneyToWallet = async ({ userId, amount }) => {
    if (!userId) {
        throw new Error("Collector identification is required to deposit funds.");
    }

    const numericAmount = Math.round(Number(amount));
    if (isNaN(numericAmount) || numericAmount < 1) {
        throw new Error("Deposit amount must be at least ₹1.");
    }

    if (numericAmount > 500000) {
        throw new Error("Maximum single deposit limit is ₹5,00,000 via digital gateway.");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("Collector profile not found.");
    }

    const amountInPaise = numericAmount * 100;
    const receipt = `rcpt_wtop_${Date.now().toString(36).toUpperCase()}`;

    const rzpOrder = await createRazorpayGatewayOrder({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
            userId: userId.toString(),
            collectorEmail: user.email,
            type: "wallet_topup",
            depositAmount: numericAmount
        }
    });

    const activeKeyId = getKeyId() || RAZORPAY_KEY_ID;
    const cleanOrderId = (rzpOrder.id || `order_${Date.now()}`).replace("order_", "");
    const testPaymentId = `pay_wtop_${cleanOrderId}`;
    const testSignature = generateTestRazorpaySignature(rzpOrder.id, testPaymentId);

    const isSimulated = Boolean(
        rzpOrder.isSimulated ||
        !rzpOrder.id ||
        rzpOrder.id.startsWith("order_delta_") ||
        activeKeyId?.includes("deltaVault") ||
        activeKeyId?.includes("dummy")
    );

    return {
        success: true,
        gateway: "Razorpay",
        keyId: activeKeyId,
        razorpayOrderId: rzpOrder.id,
        isSimulated,
        testPaymentId,
        testSignature,
        amount: rzpOrder.amount, // in paise
        currency: rzpOrder.currency || "INR",
        depositAmount: numericAmount,
        user: {
            name: user.name,
            email: user.email,
            phone: user.phone || ""
        }
    };
};


export const verifyAndCompleteAddMoneyToWallet = async ({
    userId,
    amount,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
}) => {
    if (!userId) {
        throw new Error("Collector identification is required.");
    }

    const numericAmount = Math.round(Number(amount));
    if (isNaN(numericAmount) || numericAmount < 1) {
        throw new Error("Invalid deposit amount.");
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new Error("Missing required payment gateway verification parameters.");
    }

    const isValidSignature = verifyRazorpaySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
    });

    if (!isValidSignature) {
        throw new Error("Cryptographic payment signature verification failed. Deposit rejected.");
    }

    const existingTransaction = await WalletTransaction.findOne({
        user: userId,
        description: { $regex: razorpay_payment_id }
    });
    if (existingTransaction) {
        const wallet = await getOrCreateWallet(userId);
        return {
            success: true,
            message: "Deposit already processed.",
            balance: wallet.balance,
            transaction: existingTransaction
        };
    }

    const { wallet, transaction } = await creditWallet({
        userId,
        amount: numericAmount,
        purpose: "Wallet Top-up",
        description: `Wallet top-up via Razorpay (${razorpay_payment_id})`
    });

    return {
        success: true,
        message: `Successfully deposited ₹${numericAmount.toLocaleString("en-IN")} into your DELTA Vault Wallet.`,
        balance: wallet.balance,
        transaction
    };
};
