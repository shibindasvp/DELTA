import { 
    createRazorpayGatewayOrder, 
    verifyRazorpaySignature, 
    generateTestRazorpaySignature,
    RAZORPAY_KEY_ID 
} from "../../config/razorpay.js";
import { 
    getCheckoutDetails, 
    placeOrder, 
    getOrderById,
    clearUserCartAndRegisterCoupons
} from "./checkout.service.js";
import { getOrCreateWallet, debitWallet } from "./wallet.service.js";
import Order from "../../models/order.model.js";
import Cart from "../../models/cart.model.js";
import User from "../../models/user.model.js";
import Product from "../../models/product.model.js";
import Address from "../../models/address.model.js";
import { deductStockForOrderItem } from "../admin/order.service.js";
import { 
    assertProductNotUnderDeclineCooldown 
} from "./cooldown.service.js";


export const initiateRazorpayOrder = async ({ userId, addressId }) => {
    const checkoutData = await getCheckoutDetails(userId);

    if (checkoutData.isEmpty) {
        throw new Error("Your shopping bag is empty. Please select timepieces before checkout.");
    }

    if (checkoutData.hasStockIssue) {
        throw new Error(checkoutData.stockIssueMessage || "Cart contains out-of-stock items.");
    }

    const couponWarning = (checkoutData.couponWarnings || []).find(w => w.isBlocked || w.isInactive) || (checkoutData.couponWarnings || [])[0];
    if (couponWarning) {
        const couponErr = new Error(`${couponWarning.message} Your order total has been updated—please review before paying.`);
        couponErr.code = (couponWarning.isBlocked || couponWarning.isInactive) ? "COUPON_BLOCKED" : "COUPON_REMOVED";
        throw couponErr;
    }

    for (const item of checkoutData.cart.items) {
        if (item.product) {
            await assertProductNotUnderDeclineCooldown(userId, item.product._id, item.product.name);
        }
    }

    const targetAddress = checkoutData.addresses.find(a => a._id.toString() === addressId?.toString()) 
        || checkoutData.defaultAddress;

    if (!targetAddress) {
        throw new Error("Please select or add a verified delivery destination.");
    }

    const user = await User.findById(userId);
    const grandTotal = checkoutData.summary.grandTotal;

    if (grandTotal <= 0) {
        throw new Error("Invalid order total. Grand total must be greater than zero.");
    }

    const amountInPaise = Math.round(grandTotal * 100);

    if (amountInPaise > 50000000) {
        throw new Error(
            `Order total (₹${Number(grandTotal).toLocaleString('en-IN')}) exceeds Razorpay's maximum transaction limit of ₹5,00,000. For timepiece allocations exceeding ₹5,00,000, please select Cash on Delivery or Vault Wallet Reserve.`
        );
    }

    const receipt = `rcpt_rzp_${Date.now().toString(36).toUpperCase()}`;

    const rzpOrder = await createRazorpayGatewayOrder({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
            userId: userId.toString(),
            collectorEmail: user.email,
            deliveryCity: targetAddress.city
        }
    });

    const cleanOrderId = (rzpOrder.id || `order_${Date.now()}`).replace("order_", "");
    const testPaymentId = `pay_${cleanOrderId}`;
    const testSignature = generateTestRazorpaySignature(rzpOrder.id, testPaymentId);

    const activeKeyId = process.env.RAZORPAY_KEY_ID || RAZORPAY_KEY_ID;
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
        grandTotal,
        user: {
            name: targetAddress.fullName || user.name,
            email: user.email,
            phone: targetAddress.phone
        },
        address: {
            addressId: targetAddress._id,
            city: targetAddress.city,
            state: targetAddress.state,
            pincode: targetAddress.pincode
        },
        summary: checkoutData.summary
    };
};


export const verifyAndCompleteRazorpayOrder = async ({
    userId,
    addressId,
    notes = "",
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
}) => {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new Error("Missing required Razorpay payment authorization payload.");
    }

    const isValidSignature = verifyRazorpaySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
    });

    if (!isValidSignature) {
        throw new Error("Cryptographic signature verification failed for Razorpay transaction. Payment authorization rejected.");
    }

    const order = await placeOrder({
        userId,
        addressId,
        paymentMethod: "Razorpay",
        paymentStatus: "Completed",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paidAt: new Date(),
        notes
    });

    return {
        success: true,
        orderId: order._id,
        orderNumber: order.orderNumber,
        redirect: `/order/success/${order._id}`,
        order
    };
};


export const recordFailedPaymentOrder = async ({
    userId,
    addressId,
    notes = "",
    paymentMethod = "Razorpay",
    failureReason = "Transaction authorization declined",
    razorpayOrderId = "",
    paypalOrderId = ""
}) => {
    const cleanRazorpayOrderId = (razorpayOrderId || "").trim();
    const cleanPaypalOrderId = (paypalOrderId || "").trim();

    if (cleanRazorpayOrderId || cleanPaypalOrderId) {
        const gatewayMatch = cleanRazorpayOrderId
            ? { razorpayOrderId: cleanRazorpayOrderId }
            : { paypalOrderId: cleanPaypalOrderId };

        const completedOrder = await Order.findOne({
            user: userId,
            ...gatewayMatch,
            paymentStatus: "Completed"
        }).lean();

        if (completedOrder) {
            return {
                success: true,
                alreadyCompleted: true,
                orderId: completedOrder._id,
                orderNumber: completedOrder.orderNumber,
                message: "Payment for this order was already completed.",
                redirect: `/order/success/${completedOrder._id}`
            };
        }

        const existingFailedOrder = await Order.findOne({
            user: userId,
            ...gatewayMatch,
            paymentStatus: "Failed",
            orderStatus: { $ne: "Cancelled" }
        }).sort({ createdAt: -1 });

        if (existingFailedOrder) {
            if (failureReason && !existingFailedOrder.paymentFailureReason) {
                existingFailedOrder.paymentFailureReason = failureReason;
                await existingFailedOrder.save();
            }
            const resolvedReason = existingFailedOrder.paymentFailureReason || failureReason;
            return {
                success: false,
                paymentFailed: true,
                orderId: existingFailedOrder._id,
                orderNumber: existingFailedOrder.orderNumber,
                message: resolvedReason,
                redirect: `/checkout/payment-failed/${existingFailedOrder._id}?reason=${encodeURIComponent(resolvedReason)}`
            };
        }
    }

    const order = await placeOrder({
        userId,
        addressId,
        paymentMethod: paymentMethod || "Razorpay",
        paymentStatus: "Failed",
        paymentFailureReason: failureReason,
        razorpayOrderId: cleanRazorpayOrderId,
        paypalOrderId: cleanPaypalOrderId,
        notes
    });

    return {
        success: false,
        paymentFailed: true,
        orderId: order._id,
        orderNumber: order.orderNumber,
        message: failureReason,
        redirect: `/checkout/payment-failed/${order._id}?reason=${encodeURIComponent(failureReason)}`
    };
};


export const retryOrderPayment = async ({ userId, orderId, paymentMethod = "Razorpay" }) => {
    const order = await getOrderById(orderId, userId);

    if (order.paymentStatus === "Completed") {
        throw new Error("Payment for this timepiece order is already authorized and completed.");
    }

    if (order.orderStatus === "Cancelled") {
        throw new Error("Cannot retry payment for a cancelled order.");
    }

    if (paymentMethod === "Cash on Delivery" || paymentMethod === "COD") {
        if (order.grandTotal > 1000000) {
            throw new Error(
                `Cash on Delivery is limited to allocations under ₹10,00,000. Current total is ₹${Number(order.grandTotal).toLocaleString('en-IN')}. Please select Razorpay or Vault Wallet.`
            );
        }

        if (!order.isStockDeducted) {
            for (const item of order.items) {
                await deductStockForOrderItem(item);
            }
            order.isStockDeducted = true;
        }

        order.paymentMethod = "Cash on Delivery";
        order.paymentStatus = "Pending";
        order.paymentFailureReason = "";
        await order.save();

        await clearUserCartAndRegisterCoupons(userId, order);

        return {
            success: true,
            gateway: "Cash on Delivery",
            completed: true,
            orderId: order._id,
            orderNumber: order.orderNumber,
            redirect: `/order/success/${order._id}`
        };
    } else if (paymentMethod === "Wallet") {
        if (order.paymentStatus === "Completed") {
            return {
                success: true,
                gateway: "Wallet",
                completed: true,
                orderId: order._id,
                orderNumber: order.orderNumber,
                redirect: `/order/success/${order._id}`
            };
        }
        const wallet = await getOrCreateWallet(userId);
        if (wallet.balance < order.grandTotal) {
            throw new Error(`Insufficient wallet balance. Required: ₹${order.grandTotal.toLocaleString('en-IN')}, Available: ₹${wallet.balance.toLocaleString('en-IN')}.`);
        }

        if (!order.isStockDeducted) {
            for (const item of order.items) {
                await deductStockForOrderItem(item);
            }
            order.isStockDeducted = true;
        }

        await debitWallet({
            userId,
            amount: order.grandTotal,
            purpose: "Wallet Payment",
            orderId: order._id,
            orderNumber: order.orderNumber,
            description: `Retry settlement for Order ${order.orderNumber} via DELTA Vault Wallet`
        });

        order.paymentMethod = "Wallet";
        order.paymentStatus = "Completed";
        order.paidAt = new Date();
        order.paymentFailureReason = "";
        await order.save();

        await clearUserCartAndRegisterCoupons(userId, order);

        return {
            success: true,
            gateway: "Wallet",
            completed: true,
            orderId: order._id,
            orderNumber: order.orderNumber,
            redirect: `/order/success/${order._id}`
        };
    } else if (paymentMethod === "Razorpay") {
        if (!order.isStockDeducted) {
            for (const item of order.items) {
                const prod = await Product.findById(item.product?._id || item.product);
                if (!prod || prod.isDeleted || !prod.isActive) {
                    throw new Error(`Timepiece "${item.productName}" is currently unavailable in the vault catalog.`);
                }
                const vId = item.variant?.variantId?.toString();
                const variant = prod.variants?.find(v => v._id?.toString() === vId);
                const available = variant ? variant.stock : prod.stock;
                if (Number(available) < Number(item.quantity)) {
                    throw new Error(`Insufficient vault stock for "${item.productName}". Available: ${available}, Requested: ${item.quantity}.`);
                }
            }
        }

        const amountInPaise = Math.round(order.grandTotal * 100);
        if (amountInPaise > 50000000) {
            throw new Error(
                `Order total (₹${Number(order.grandTotal).toLocaleString('en-IN')}) exceeds Razorpay's maximum transaction limit of ₹5,00,000. Please choose Vault Wallet or contact concierge.`
            );
        }
        const rzpOrder = await createRazorpayGatewayOrder({
            amount: amountInPaise,
            currency: "INR",
            receipt: `rcpt_retry_${order.orderNumber}`,
            notes: {
                orderId: order._id.toString(),
                orderNumber: order.orderNumber,
                userId: userId.toString()
            }
        });

        order.razorpayOrderId = rzpOrder.id;
        order.paymentMethod = "Razorpay";
        await order.save();

        const cleanOrderId = (rzpOrder.id || `order_${Date.now()}`).replace("order_", "");
        const testPaymentId = `pay_retry_${cleanOrderId}`;
        const testSignature = generateTestRazorpaySignature(rzpOrder.id, testPaymentId);

        const activeKeyId = process.env.RAZORPAY_KEY_ID || RAZORPAY_KEY_ID;
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
            amount: rzpOrder.amount,
            currency: "INR",
            orderNumber: order.orderNumber,
            grandTotal: order.grandTotal,
            user: {
                name: order.collectorName,
                email: order.collectorEmail,
                phone: order.shippingAddress?.mobile || ""
            }
        };
    }

    throw new Error(`Unsupported retry payment gateway: "${paymentMethod}"`);
};


export const verifyRetryPayment = async ({
    userId,
    orderId,
    paymentMethod = "Razorpay",
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    paypalOrderId
}) => {
    const order = await getOrderById(orderId, userId);

    if (paymentMethod === "Cash on Delivery" || paymentMethod === "COD") {
        if (order.grandTotal > 1000000) {
            throw new Error("Cash on Delivery is limited to allocations under ₹10,00,000.");
        }
        if (!order.isStockDeducted) {
            for (const item of order.items) {
                await deductStockForOrderItem(item);
            }
            order.isStockDeducted = true;
        }
        order.paymentMethod = "Cash on Delivery";
        order.paymentStatus = "Pending";
        order.paymentFailureReason = "";
        await order.save();

        await clearUserCartAndRegisterCoupons(userId, order);

        return {
            success: true,
            message: "Order successfully converted to Cash on Delivery.",
            orderId: order._id,
            orderNumber: order.orderNumber,
            redirect: `/order/success/${order._id}`
        };
    } else if (paymentMethod === "Wallet") {
        if (order.paymentStatus === "Completed") {
            return {
                success: true,
                gateway: "Wallet",
                completed: true,
                orderId: order._id,
                orderNumber: order.orderNumber,
                redirect: `/order/success/${order._id}`
            };
        }
        const wallet = await getOrCreateWallet(userId);
        if (wallet.balance < order.grandTotal) {
            throw new Error(`Insufficient wallet balance. Required: ₹${order.grandTotal.toLocaleString('en-IN')}, Available: ₹${wallet.balance.toLocaleString('en-IN')}.`);
        }

        if (!order.isStockDeducted) {
            for (const item of order.items) {
                await deductStockForOrderItem(item);
            }
            order.isStockDeducted = true;
        }

        await debitWallet({
            userId,
            amount: order.grandTotal,
            purpose: "Wallet Payment",
            orderId: order._id,
            orderNumber: order.orderNumber,
            description: `Retry settlement for Order ${order.orderNumber} via DELTA Vault Wallet`
        });

        order.paymentMethod = "Wallet";
        order.paymentStatus = "Completed";
        order.paidAt = new Date();
        order.paymentFailureReason = "";
        await order.save();

        await clearUserCartAndRegisterCoupons(userId, order);

        return {
            success: true,
            gateway: "Wallet",
            completed: true,
            orderId: order._id,
            orderNumber: order.orderNumber,
            redirect: `/order/success/${order._id}`
        };
    } else if (paymentMethod === "Razorpay") {
        const isValid = verifyRazorpaySignature({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature
        });

        if (!isValid) {
            throw new Error("Cryptographic verification failed for retry Razorpay payment.");
        }

        if (!order.isStockDeducted) {
            for (const item of order.items) {
                await deductStockForOrderItem(item);
            }
            order.isStockDeducted = true;
        }

        order.paymentMethod = "Razorpay";
        order.paymentStatus = "Completed";
        order.razorpayOrderId = razorpay_order_id;
        order.razorpayPaymentId = razorpay_payment_id;
        order.razorpaySignature = razorpay_signature;
        order.paidAt = new Date();
        order.paymentFailureReason = "";
        await order.save();

        await clearUserCartAndRegisterCoupons(userId, order);

        return {
            success: true,
            message: "Payment successfully authorized and recorded.",
            orderId: order._id,
            redirect: `/order/success/${order._id}`
        };
    }

    throw new Error(`Unsupported gateway for retry verification: "${paymentMethod}"`);
};
