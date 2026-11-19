import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/delta_ecommerce";
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
        return conn;
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        throw error;
    }
};

export default connectDB;
