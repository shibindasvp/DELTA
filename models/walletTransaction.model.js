import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
    {
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true,
            index: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        transactionId: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            index: true
        },
        type: {
            type: String,
            enum: ["Credit", "Debit"],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: [1, "Transaction amount must be at least ₹1"]
        },
        balanceAfter: {
            type: Number,
            required: true,
            min: 0
        },
        purpose: {
            type: String,
            enum: [
                "Order Cancellation Refund",
                "Order Return Refund",
                "Wallet Payment",
                "Order Payment",
                "Admin Adjustment",
                "Cashback",
                "Refund",
                "Wallet Top-up",
                "Deposit",
                "Direct Deposit",
                "Added Money"
            ],
            default: "Refund"
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null
        },
        orderNumber: {
            type: String,
            default: ""
        },
        description: {
            type: String,
            default: ""
        },
        status: {
            type: String,
            enum: ["Completed", "Failed", "Pending"],
            default: "Completed"
        }
    },
    {
        timestamps: true
    }
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("WalletTransaction", walletTransactionSchema);
