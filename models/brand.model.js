import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true },
        origin: { type: String, default: "Switzerland" },
        foundedYear: { type: Number, default: null },
        description: { type: String, default: "" },
        logo: { type: String, default: "" },
        website: { type: String, default: "" },
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false }
    },
    { timestamps: true }
);


brandSchema.index({ name: "text", origin: "text", description: "text" });
brandSchema.index({ createdAt: -1 });

export default mongoose.model("Brand", brandSchema);
