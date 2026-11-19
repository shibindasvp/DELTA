import Product from "../../models/product.model.js";
import Brand from "../../models/brand.model.js";
import { getAllActiveBrands } from "../../repositories/brand.repository.js";
import { ensureDefaultBrandsExist } from "./brand.service.js";
import { getPaginationData } from "../../utils/pagination.js";
import { formatErrorMessage } from "../../utils/error.js";


export const getInventoryList = async ({
    search = "",
    brandId = "",
    stockStatus = "all",
    sortBy = "updated_desc",
    page = 1,
    limit = 10
}) => {
    await ensureDefaultBrandsExist();

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * pageLimit;

    const filter = { isDeleted: false };

    if (brandId && brandId.trim()) {
        filter.brand = brandId.trim();
    }


    if (stockStatus === "outOfStock") {
        filter.stock = { $lte: 0 };
    } else if (stockStatus === "lowStock") {
        filter.stock = { $gt: 0, $lte: 3 };
    } else if (stockStatus === "inStock") {
        filter.stock = { $gt: 3 };
    }

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [
            { name: regex },
            { brandName: regex },
            { modelNumber: regex },
            { "variants.sku": regex },
            { "variants.color": regex },
            { "variants.material": regex },
            { "variants.dial": regex }
        ];
    }

    let sortOption = { updatedAt: -1 };
    if (sortBy === "stock_asc") {
        sortOption = { stock: 1, name: 1 };
    } else if (sortBy === "stock_desc") {
        sortOption = { stock: -1, name: 1 };
    } else if (sortBy === "price_desc") {
        sortOption = { price: -1 };
    } else if (sortBy === "price_asc") {
        sortOption = { price: 1 };
    } else if (sortBy === "name_asc") {
        sortOption = { name: 1 };
    } else {
        sortOption = { updatedAt: -1 };
    }

    const [products, totalProducts] = await Promise.all([
        Product.find(filter)
            .populate("brand", "name slug origin foundedYear")
            .sort(sortOption)
            .skip(skip)
            .limit(pageLimit)
            .lean(),
        Product.countDocuments(filter)
    ]);

    const pagination = getPaginationData({
        page: currentPage,
        limit: pageLimit,
        totalItems: totalProducts
    });

    return {
        products,
        pagination,
        search: (search || "").trim(),
        brandId,
        stockStatus,
        sortBy
    };
};


export const getInventoryStats = async () => {
    await ensureDefaultBrandsExist();

    const [
        totalProducts,
        inStockProducts,
        lowStockProducts,
        outOfStockProducts,
        allProducts
    ] = await Promise.all([
        Product.countDocuments({ isDeleted: false }),
        Product.countDocuments({ isDeleted: false, stock: { $gt: 3 } }),
        Product.countDocuments({ isDeleted: false, stock: { $gt: 0, $lte: 3 } }),
        Product.countDocuments({ isDeleted: false, stock: { $lte: 0 } }),
        Product.find({ isDeleted: false }).select("price discountPrice stock variants").lean()
    ]);

    let totalVaultUnits = 0;
    let totalValuation = 0;
    let outOfStockVariantsCount = 0;
    let lowStockVariantsCount = 0;

    for (const p of allProducts) {
        totalVaultUnits += (p.stock || 0);

        if (p.variants && p.variants.length > 0) {
            for (const v of p.variants) {
                const vStock = parseInt(v.stock, 10) || 0;
                const vPrice = Number(v.discountPrice || v.price || p.price || 0);
                totalValuation += (vStock * vPrice);

                if (vStock <= 0) {
                    outOfStockVariantsCount++;
                } else if (vStock <= 3) {
                    lowStockVariantsCount++;
                }
            }
        } else {
            const pPrice = Number(p.discountPrice || p.price || 0);
            totalValuation += ((p.stock || 0) * pPrice);
        }
    }

    return {
        totalProducts,
        totalVaultUnits,
        totalValuation,
        inStockProducts,
        lowStockProducts,
        outOfStockProducts,
        outOfStockVariantsCount,
        lowStockVariantsCount
    };
};


export const updateProductStock = async ({
    productId,
    variantId = null,
    newStock,
    adjustmentType = "set", 
    reason = "",
    adminName = "Vault Administrator"
}) => {
    if (!productId) {
        throw new Error("Product ID is required for inventory stock update.");
    }

    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) {
        throw new Error("Timepiece not found in vault registry.");
    }

    let parsedVal = parseInt(newStock, 10);
    if (isNaN(parsedVal)) {
        throw new Error("Stock value must be a valid integer number.");
    }

    let updatedVariant = null;

    if (variantId && product.variants && product.variants.length > 0) {
        const variantIndex = product.variants.findIndex(
            v => v._id.toString() === variantId.toString()
        );

        if (variantIndex === -1) {
            throw new Error("Timepiece variant not found.");
        }

        let currentVariantStock = product.variants[variantIndex].stock || 0;
        let finalVariantStock = currentVariantStock;

        if (adjustmentType === "add") {
            finalVariantStock = currentVariantStock + parsedVal;
        } else if (adjustmentType === "deduct") {
            finalVariantStock = Math.max(0, currentVariantStock - parsedVal);
        } else {
            finalVariantStock = Math.max(0, parsedVal);
        }

        product.variants[variantIndex].stock = finalVariantStock;
        updatedVariant = product.variants[variantIndex];

        product.stock = product.variants.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0);
    } else {
        let currentStock = product.stock || 0;
        let finalStock = currentStock;

        if (adjustmentType === "add") {
            finalStock = currentStock + parsedVal;
        } else if (adjustmentType === "deduct") {
            finalStock = Math.max(0, currentStock - parsedVal);
        } else {
            finalStock = Math.max(0, parsedVal);
        }

        product.stock = finalStock;

        if (product.variants && product.variants.length === 1) {
            product.variants[0].stock = finalStock;
            updatedVariant = product.variants[0];
        }
    }

    await product.save();

    return {
        product,
        updatedVariant,
        totalStock: product.stock,
        variantStock: updatedVariant ? updatedVariant.stock : product.stock,
        status: product.stock <= 0 ? "outOfStock" : (product.stock <= 3 ? "lowStock" : "inStock")
    };
};


export const bulkUpdateProductStock = async (updates = []) => {
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error("No inventory updates provided.");
    }

    const results = [];
    for (const item of updates) {
        if (!item.productId) continue;
        try {
            const res = await updateProductStock({
                productId: item.productId,
                variantId: item.variantId || null,
                newStock: item.newStock,
                adjustmentType: item.adjustmentType || "set",
                reason: item.reason || "Bulk Vault Rebalance"
            });
            results.push({ success: true, productId: item.productId, variantId: item.variantId, totalStock: res.totalStock });
        } catch (err) {
            results.push({
                success: false,
                productId: item.productId,
                error: formatErrorMessage(err, "Failed to update stock for this item.")
            });
        }
    }

    return results;
};


export const getInventoryExportData = async () => {
    const products = await Product.find({ isDeleted: false })
        .populate("brand", "name")
        .sort({ name: 1 })
        .lean();

    const rows = [];

    for (const p of products) {
        const brandName = p.brand && p.brand.name ? p.brand.name : (p.brandName || "DELTA Manufacture");
        const refNo = p.modelNumber || `REF-DLT-${p._id.toString().substring(18, 24).toUpperCase()}`;

        if (p.variants && p.variants.length > 0) {
            for (const v of p.variants) {
                const effectivePrice = v.discountPrice || v.price || p.price || 0;
                const vStock = v.stock !== undefined ? v.stock : 0;
                rows.push({
                    reference: refNo,
                    model: p.name,
                    brand: brandName,
                    variant: v.color || "Standard Edition",
                    sku: v.sku || "N/A",
                    material: v.material || "Oystersteel",
                    dial: v.dial || "Standard",
                    unitPrice: effectivePrice,
                    stock: vStock,
                    totalValuation: vStock * effectivePrice,
                    status: vStock <= 0 ? "Out of Stock" : (vStock <= 3 ? "Low Stock" : "In Stock")
                });
            }
        } else {
            const effectivePrice = p.discountPrice || p.price || 0;
            const pStock = p.stock || 0;
            rows.push({
                reference: refNo,
                model: p.name,
                brand: brandName,
                variant: "Standard Edition",
                sku: "N/A",
                material: p.specs?.case || "Manufacture Case",
                dial: p.specs?.dial || "Manufacture Dial",
                unitPrice: effectivePrice,
                stock: pStock,
                totalValuation: pStock * effectivePrice,
                status: pStock <= 0 ? "Out of Stock" : (pStock <= 3 ? "Low Stock" : "In Stock")
            });
        }
    }

    return rows;
};
