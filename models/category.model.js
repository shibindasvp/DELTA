import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true },
        description: { type: String, default: "" },
        image: { type: String, default: "" },
        imagePublicId: { type: String, default: "" },
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false }
    },
    { timestamps: true }
);

categorySchema.index({ name: "text", description: "text" });
categorySchema.index({ createdAt: -1 });

export default mongoose.model("Category", categorySchema);
