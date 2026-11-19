import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        subtitle: { type: String, default: "" },
        link: { type: String, default: "" },
        image: { type: String, required: true },
        imagePublicId: { type: String, default: "" },
        position: { type: String, enum: ["hero", "promotional", "sidebar", "footer"], default: "hero" },
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false }
    },
    { timestamps: true }
);

bannerSchema.index({ position: 1, order: 1, isActive: 1 });

export default mongoose.model("Banner", bannerSchema);
