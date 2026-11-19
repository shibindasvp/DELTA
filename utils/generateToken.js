import jwt from "jsonwebtoken";

export const generateToken = (user) => {
    if (!user?._id) {
        throw new Error("Cannot generate token: user ID is missing");
    }

    return jwt.sign(
        {
            userId: user._id.toString(),
            role: user.role || "user"
        },
        process.env.JWT_SECRET || "delta_super_secret_jwt_key_2026",
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d"
        }
    );
};

export const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET || "delta_super_secret_jwt_key_2026");
};