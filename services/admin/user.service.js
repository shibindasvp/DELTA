import {
    findUsersWithPagination,
    setUserBlockStatus,
    findUserById
} from "../../repositories/user.repository.js";
import Address from "../../models/address.model.js";
import { getPaginationData } from "../../utils/pagination.js";


export const getUsersList = async ({
    search = "",
    page = 1,
    limit = 10

}) => {

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * pageLimit;

    const { users, totalUsers } = await findUsersWithPagination({
        search: (search || "").trim(),
        skip,
        limit: pageLimit,
        sort: {createdAt:-1 } 
    }); 

    const pagination = getPaginationData({
        page: currentPage,
        limit: pageLimit,
        totalItems: totalUsers
    });

    return {
        users,
        pagination,
        search: (search || "").trim()
    };
};

export const blockUser = async (userId) => {
    const user = await findUserById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    if (user.role === "admin") {
        throw new Error("Cannot block an administrator account");
    }

    return await setUserBlockStatus(userId, true);
};

export const unblockUser = async (userId) => {
    const user = await findUserById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    return await setUserBlockStatus(userId, false);
};

export const getUserDetails = async (userId) => {
    const user = await findUserById(userId);
    if (!user) {
        throw new Error("Collector account not found");
    }
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    const userObj = user.toObject ? user.toObject() : { ...user };
    userObj.addresses = addresses;
    return userObj;
};

export const exportUsersCsv = async ({ search = "" } = {}) => {
    const query = {};
    if (search && search.trim()) {
        const cleanSearch = search.trim();
        const searchRegex = new RegExp(cleanSearch, "i");
        query.$or = [
            { name: searchRegex },
            { email: searchRegex },
            { phone: searchRegex }
        ];
    }

    const User = (await import("../../models/user.model.js")).default;
    const users = await User.find(query).sort({ createdAt: -1 }).lean();

    const headers = [
        "User ID",
        "Full Name",
        "Email Address",
        "Phone Number",
        "Account Role",
        "Auth Provider",
        "Verification Status",
        "Account Status",
        "Registration Date",
        "Registration Time"
    ];

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = users.map(u => [
        escapeCsv(u._id),
        escapeCsv(u.name || "N/A"),
        escapeCsv(u.email || "N/A"),
        escapeCsv(u.phone || "N/A"),
        escapeCsv(u.role === "admin" ? "System Administrator" : "Verified Collector"),
        escapeCsv((u.authProvider || "local").toUpperCase()),
        escapeCsv(u.isVerified ? "Verified" : "Pending"),
        escapeCsv(u.isBlocked ? "Restricted / Blocked" : "Active Member"),
        escapeCsv(new Date(u.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })),
        escapeCsv(new Date(u.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }))
    ]);

    const csvContent = [
        headers.map(escapeCsv).join(","),
        ...rows.map(r => r.join(","))
    ].join("\r\n");

    return csvContent;
};



