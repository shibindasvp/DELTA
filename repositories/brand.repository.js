import Brand from "../models/brand.model.js";
import Product from "../models/product.model.js";

export const createBrand = async (data) => {
    return await Brand.create(data);
};

export const findBrandById = async (id) => {
    return await Brand.findById(id);
};

export const findBrandByName = async (name) => {
    if (!name) return null;
    return await Brand.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        isDeleted: false
    });
};

export const findBrandByNameExcludingId = async (name, excludeId) => {
    if (!name) return null;
    return await Brand.findOne({
        _id: { $ne: excludeId },
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        isDeleted: false
    });
};

export const findBrandBySlug = async (slug) => {
    if (!slug) return null;
    return await Brand.findOne({ slug: slug.toLowerCase().trim() });
};

export const findBrandsWithPagination = async ({
    search = "",
    skip = 0,
    limit = 10,
    sort = { createdAt: -1 },
    status = "all",
    includeDeleted = false
}) => {
    const filter = {};

    if (status === "archived") {
        filter.isDeleted = true;
    } else if (status === "active") {
        filter.isDeleted = false;
        filter.isActive = true;
    } else if (status === "inactive" || status === "unlisted") {
        filter.isDeleted = false;
        filter.isActive = false;
    } else {
        if (!includeDeleted) {
            filter.isDeleted = false;
        }
    }

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [
            { name: regex },
            { origin: regex },
            { description: regex },
            { slug: regex }
        ];
    }

    const brands = await Brand.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

    const totalBrands = await Brand.countDocuments(filter);

 
    const brandIds = brands.map(b => b._id);
    const productCounts = await Product.aggregate([
        { $match: { brand: { $in: brandIds }, isDeleted: false } },
        { $group: { _id: "$brand", count: { $sum: 1 } } }
    ]);

    const countMap = {};
    productCounts.forEach(pc => {
        countMap[pc._id.toString()] = pc.count;
    });

    const enrichedBrands = brands.map(b => ({
        ...b,
        productCount: countMap[b._id.toString()] || 0
    }));

    return {
        brands: enrichedBrands,
        totalBrands
    };
};

export const updateBrandById = async (id, data) => {
    return await Brand.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

export const softDeleteBrandById = async (id) => {
    return await Brand.findByIdAndUpdate(
        id,
        { isDeleted: true, isActive: false },
        { new: true }
    );
};

export const restoreBrandById = async (id) => {
    return await Brand.findByIdAndUpdate(
        id,
        { isDeleted: false, isActive: true },
        { new: true }
    );
};

export const toggleBrandStatus = async (id) => {
    const brand = await Brand.findById(id);
    if (!brand) return null;
    brand.isActive = !brand.isActive;
    return await brand.save();
};

export const hardDeleteBrandById = async (id) => {
    return await Brand.findByIdAndDelete(id);
};

export const getAllActiveBrands = async () => {
    return await Brand.find({ isDeleted: false, isActive: true })
        .sort({ name: 1 })
        .lean();
};
