import {
    findActiveProductsForShop,
    findActiveProductBySlug,
    findProductBySlugForDetail,
    findRelatedProducts,
    getShopFilterData
} from "../../repositories/product.repository.js";
import { ensureDefaultBrandsExist } from "../admin/brand.service.js";
import { getPaginationData } from "../../utils/pagination.js";

export const getShopProducts = async ({
    search = "",
    brand = "",
    material = "",
    priceMin = 0,
    priceMax = null,
    inStockOnly = false,
    sort = "newest",
    page = 1,
    limit = 12
}) => {
    await ensureDefaultBrandsExist();

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (currentPage - 1) * pageLimit;

    const minPrice = parseFloat(priceMin) || 0;
    const maxPrice = priceMax ? parseFloat(priceMax) : null;
    const isStockFiltered = inStockOnly === "true" || inStockOnly === true || inStockOnly === "on";

    const [{ products, totalProducts }, filterData] = await Promise.all([
        findActiveProductsForShop({
            search: (search || "").trim(),
            brandSlug: (brand || "").trim(),
            material: (material || "").trim(),
            priceMin: minPrice,
            priceMax: maxPrice,
            inStockOnly: isStockFiltered,
            sort: (sort || "newest").trim(),
            skip,
            limit: pageLimit
        }),
        getShopFilterData()
    ]);

    const pagination = getPaginationData({
        page: currentPage,
        limit: pageLimit,
        totalItems: totalProducts
    });

    return {
        products,
        pagination,
        filterData,
        query: {
            search: (search || "").trim(),
            brand: (brand || "").trim(),
            material: (material || "").trim(),
            priceMin: minPrice > 0 ? minPrice : "",
            priceMax: maxPrice ? maxPrice : "",
            inStockOnly: isStockFiltered,
            sort: (sort || "newest").trim(),
            limit: pageLimit
        }
    };
};

export const getProductDetail = async (slug) => {
    await ensureDefaultBrandsExist();

    const product = await findProductBySlugForDetail(slug);
    if (!product) {
        return null;
    }

    const isUnlisted = !product.isActive;
    const isDeleted = Boolean(product.isDeleted);
    const isBrandBlocked = Boolean(product.brand && (!product.brand.isActive || product.brand.isDeleted));
    const isUnavailable = isUnlisted || isDeleted || isBrandBlocked;

    let unavailableReason = "";
    if (isDeleted) {
        unavailableReason = "This timepiece has been archived and is no longer available in the vault.";
    } else if (isUnlisted) {
        unavailableReason = "This timepiece is currently unlisted by the Maison and is unavailable for purchase.";
    } else if (isBrandBlocked) {
        unavailableReason = "This manufacture Maison is currently inactive, and its timepieces are temporarily unavailable.";
    } else if (isUnavailable) {
        unavailableReason = "This timepiece is currently unavailable in the vault.";
    }

    const relatedProducts = await findRelatedProducts(
        product._id,
        product.brand ? product.brand._id : null,
        4
    );

    return {
        product,
        relatedProducts,
        isUnavailable,
        unavailableReason
    };
};
