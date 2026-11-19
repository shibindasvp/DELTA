import { name } from "ejs";
import User from "../models/user.model.js";


export const findUserByEmail = async (email) => {
    if (!email) return null;
    return await User.findOne({ email: email.toLowerCase().trim() });
};

export const findUserWithPassword = async (email) => {
    if (!email) return null;
    return await User.findOne({
        email: email.toLowerCase().trim()
    }).select("+password");
};

export const deleteUserByEmail=async(email)=>{
  
    return await User.deleteOne({
        email:email.toLowerCase().trim()
    })
}

export const findUserById = async (userId) => {
    return await User.findById(userId).select("-password");
};

export const createUser = async (data) => {
    return await User.create(data);
};

export const updateUserById = async (userId, data) => {
    return await User.findByIdAndUpdate(
        userId,
        data,
        {
            new: true,
            runValidators: true
        }
    ).select("-password");
};

export const updateUserPassword = async (userId, hashedPassword) => {
    return await User.findByIdAndUpdate(
        userId,
        {
            password: hashedPassword,
            authProvider: "local"
        },
        {
            new: true
        }
    );
};

export const findOAuthUser = async (provider, providerId) => {
    return await User.findOne({
        authProvider: provider,
        providerId
    });
};

export const findUsersWithPagination = async ({
    search = "",
    skip = 0,
    limit = 10,
    sort = {createdAt:-1 }
}) => {
    const filter = {};

    

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [
            { name: regex },
            { email: regex },
            { phone: regex }
        ];
    }

    const users = await User.find(filter)
        .sort(sort)
        .collation({locale:"en",strength:2})
        .skip(skip)
        .limit(limit)
        .select("-password")
        .lean();

    const totalUsers = await User.countDocuments(filter);

    return {
        users,
        totalUsers
    };
};

export const setUserBlockStatus = async (userId, isBlocked) => {
    return await User.findByIdAndUpdate(
        userId,
        { isBlocked },
        { new: true }
    ).select("-password");
};

