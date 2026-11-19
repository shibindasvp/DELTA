import dns from "dns";
import mongoose from "mongoose";

// Configure public DNS servers to resolve MongoDB Atlas SRV records on networks that refuse SRV DNS queries
try {
    dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (dnsErr) {
    console.warn("DNS server configuration note:", dnsErr.message);
}

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
