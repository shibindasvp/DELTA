import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";

export const findAdminByEmail = async (email) => {
    if (!email) return null;
    const normalized = email.toLowerCase().trim();


    let admin = await Admin.findOne({ email: normalized }).select("+password");
    if (admin) return admin;


    const userAdmin = await User.findOne({
        email: normalized,
        role: "admin"
    }).select("+password");

    return userAdmin;
};

export const findAdminById = async (adminId) => {
    let admin = await Admin.findById(adminId).select("-password");
    if (admin) return admin;
    return await User.findOne({ _id: adminId, role: "admin" }).select("-password");
};

export const createAdmin = async (data) => {
    return await Admin.create(data);
};
