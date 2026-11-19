import { findAdminByEmail } from "../../repositories/admin.repository.js";
import { comparePassword, hashPassword } from "../../utils/hashPassword.js";
import { generateToken } from "../../utils/generateToken.js";
import { createAndSendOTP, verifyOTP } from "../user/otp.service.js";
import Admin from "../../models/admin.model.js";
import User from "../../models/user.model.js";

export const loginAdmin = async (email, password) => {
    const normalizedEmail = (email || "").trim().toLowerCase();


    let admin = await findAdminByEmail(normalizedEmail);

    if (!admin && normalizedEmail === (process.env.ADMIN_EMAIL || "delta@gmail.com").toLowerCase()) {
        const defaultAdminPassword = process.env.ADMIN_PASSWORD || "@Delta123";
        const hashedPassword = await hashPassword(defaultAdminPassword);

        admin = await Admin.create({
            name: "DELTA Super Admin",
            email: normalizedEmail,
            password: hashedPassword,
            role: "admin"
        });
    }

    if (!admin) {
        throw new Error("Invalid admin credentials");
    }

    if (admin.isBlocked) {
        throw new Error("Your administrator account has been blocked.");
    }

    const isMatch = await comparePassword(password, admin.password);
    if (!isMatch) {
        throw new Error("Invalid admin credentials");
    }

    const adminObj = admin.toObject ? admin.toObject() : admin;
    delete adminObj.password;

    const token = generateToken({
        _id: admin._id,
        role: "admin",
        email: admin.email,
        name: admin.name
    });

    return {
        admin: adminObj,
        token
    };
};

export const startAdminForgotPassword = async (email) => {
    const normalizedEmail = (email || "").trim().toLowerCase();
    const admin = await findAdminByEmail(normalizedEmail);
    if (!admin) {
        throw new Error("No administrator account found with this email address.");
    }

    await createAndSendOTP({
        email: normalizedEmail,
        purpose: "admin-forgot-password"
    });
    

    return { email: normalizedEmail };
};

export const resetAdminPassword = async ({ email, otp, password }) => {
    const normalizedEmail = (email || "").trim().toLowerCase();
    const admin = await findAdminByEmail(normalizedEmail);
    if (!admin) {
        throw new Error("No administrator account found.");
    }

    await verifyOTP({
        email: normalizedEmail,
        otp,
        purpose: "admin-forgot-password",
        consume: true
    });

    const hashedPassword = await hashPassword(password);

    if (admin.constructor && admin.constructor.modelName === "Admin") {
        admin.password = hashedPassword;
        await admin.save();
    } else {
        await User.findByIdAndUpdate(admin._id, { password: hashedPassword });
    }

    return true;
};
