import Product from "../models/product.model.js";
import Brand from "../models/brand.model.js";

export const createProduct = async (data) => {
    return await Product.create(data);
};

export const findProductById = async (id) => {
    return await Product.findById(id).populate("brand", "name slug origin foundedYear isActive isDeleted");
};

export const findProductByName = async (name) => {
    if (!name) return null;
    return await Product.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        isDeleted: false
    });
};

export const findProductByNameExcludingId = async (name, excludeId) => {
    if (!name) return null;
    return await Product.findOne({
        _id: { $ne: excludeId },
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        isDeleted: false
    });
};

export const findProductsWithPagination = async ({
    search = "",
    brandId = "",
    status = "",
    skip = 0,
    limit = 10,
    sort = {createdAt: -1 },
    includeDeleted = false
}) => {
    const filter = {};
    
   
    if (status === "archived" || status === "deleted") {
        filter.isDeleted = true;
    } else if (status === "active") {
        filter.isDeleted = false;
        filter.isActive = true;
    } else if (status === "outOfStock") {
        filter.isDeleted = false;
        filter.stock = { $lte: 0 };
    } else if (status === "unlisted") {
        filter.isDeleted = false;
        filter.isActive = false;
    } else if (!includeDeleted) {
        filter.isDeleted = false;
    }

    
    if (brandId) {
        filter.brand = brandId;
    }

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [
            { name: regex },
            { brandName: regex },
            { modelNumber: regex },
            { description: regex },
            { "variants.color": regex },
            { "variants.material": regex },
            { "variants.dial": regex }
        ];
    }

    const products = await Product.find(filter)
        .populate("brand", "name slug origin foundedYear isActive isDeleted")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

    const totalProducts = await Product.countDocuments(filter);

    return {
        products,
        totalProducts
    };
};


export const findActiveProductsForShop = async ({
    search = "",
    brandSlug = "",

    material = "",
    priceMin = 0,
    priceMax = null,
    inStockOnly = false,
    sort = "newest",
    skip = 0,
    limit = 12
}) => {

    const activeBrands = await Brand.find({ isDeleted: false, isActive: true }).select("_id slug");
    const activeBrandIds = activeBrands.map(b => b._id);

    const filter = {
        isDeleted: false,
        isActive: true,
        brand: { $in: activeBrandIds }
    };


    if (brandSlug && brandSlug.trim()) {
        const targetBrand = activeBrands.find(b => b.slug === brandSlug.trim().toLowerCase());
        if (targetBrand) {
            filter.brand = targetBrand._id;
        } else {
            return { products: [], totalProducts: 0 };
        }
    }


    if (material && material.trim()) {
        filter["variants.material"] = { $regex: new RegExp(material.trim(), "i") };
    }


    if (inStockOnly) {
        filter.stock = { $gt: 0 };
    }


    if (priceMin > 0 || (priceMax !== null && priceMax !== undefined && priceMax > 0)) {
        filter.price = {};
        if (priceMin > 0) filter.price.$gte = Number(priceMin);
        if (priceMax > 0) filter.price.$lte = Number(priceMax);
    }


    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [
            { name: regex },
            { brandName: regex },
            { modelNumber: regex },
            { description: regex },
            { "variants.color": regex },
            { "variants.material": regex },
            { "variants.dial": regex }
        ];
    }


    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") {
        sortOption = { price: 1 };
    } else if (sort === "price_desc") {
        sortOption = { price: -1 };
    } else if (sort === "name_asc") {
        sortOption = { name: 1 };
    } else if (sort === "name_desc") {
        sortOption = { name: -1 };
    } else {
        sortOption = { createdAt: -1 };
    }

    const products = await Product.find(filter)
        .populate("brand", "name slug origin foundedYear")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean();

    const totalProducts = await Product.countDocuments(filter);

    return {
        products,
        totalProducts
    };
};

export const findProductBySlugForDetail = async (slug) => {
    if (!slug) return null;
    const cleanSlug = String(slug).toLowerCase().trim();

    let query = {};
    if (cleanSlug.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanSlug)) {
        query.$or = [{ slug: cleanSlug }, { _id: cleanSlug }];
    } else {
        query.slug = cleanSlug;
    }

    const product = await Product.findOne(query).populate("brand", "name slug origin foundedYear description isActive isDeleted");
    return product;
};

export const findActiveProductBySlug = async (slug) => {
    if (!slug) return null;
    const cleanSlug = String(slug).toLowerCase().trim();

    let query = {
        isDeleted: false,
        isActive: true
    };

    if (cleanSlug.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanSlug)) {
        query.$or = [{ slug: cleanSlug }, { _id: cleanSlug }];
    } else {
        query.slug = cleanSlug;
    }

    const product = await Product.findOne(query).populate("brand", "name slug origin foundedYear description isActive isDeleted");

    if (!product) return null;
    if (!product.brand || product.brand.isDeleted || !product.brand.isActive) {
        return null;
    }

    return product;
};

export const findRelatedProducts = async (productId, brandId, limit = 4) => {
    const filter = {
        _id: { $ne: productId },
        isDeleted: false,
        isActive: true
    };
    if (brandId) {
        filter.brand = brandId;
    }

    let related = await Product.find(filter)
        .populate("brand", "name slug origin")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

 
    if (related.length < limit) {
        const remainingCount = limit - related.length;
        const existingIds = [productId, ...related.map(r => r._id)];
        const moreTimepieces = await Product.find({
            _id: { $nin: existingIds },
            isDeleted: false,
            isActive: true
        })
        .populate("brand", "name slug origin")
        .sort({ createdAt: -1 })
        .limit(remainingCount)
        .lean();

        related = [...related, ...moreTimepieces];
    }

    return related;
};

export const getShopFilterData = async () => {
    const brands = await Brand.find({ isDeleted: false, isActive: true })
        .sort({ name: 1 })
        .lean();

    const brandIds = brands.map(b => b._id);
    const productCounts = await Product.aggregate([
        { $match: { brand: { $in: brandIds }, isDeleted: false, isActive: true } },
        { $group: { _id: "$brand", count: { $sum: 1 } } }
    ]);

    const countMap = {};
    productCounts.forEach(pc => {
        countMap[pc._id.toString()] = pc.count;
    });

    const enrichedBrands = brands.map(b => ({
        ...b,
        activeProductCount: countMap[b._id.toString()] || 0
    }));


    const materials = [
        "Oystersteel 904L",
        "18k Everose Gold",
        "18k Yellow Gold",
        "18k White Gold",
        "Platinum 950",
        "Titanium Grade 5",
        "High-Tech Ceramic",
        "Sapphire Crystal & Carbon"
    ];

    return {
        brands: enrichedBrands,
        materials
    };
};

export const updateProductById = async (id, data) => {
    return await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

export const softDeleteProductById = async (id) => {
    return await Product.findByIdAndUpdate(
        id,
        { isDeleted: true, isActive: false },
        { new: true }
    );
};

export const restoreProductById = async (id) => {
    return await Product.findByIdAndUpdate(
        id,
        { isDeleted: false, isActive: true },
        { new: true }
    );
};

export const toggleProductStatus = async (id) => {
    const product = await Product.findById(id);
    if (!product) return null;
    product.isActive = !product.isActive;
    return await product.save();
};
