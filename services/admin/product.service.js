
export const parseSpecsInput = (data = {}) => {
    let defaultCase = "";
    let defaultDial = "";

    if (data.variantsJson) {
        try {
            const parsed = typeof data.variantsJson === "string" ? JSON.parse(data.variantsJson) : data.variantsJson;
            if (Array.isArray(parsed) && parsed[0]) {
                if (parsed[0].material) defaultCase = parsed[0].material;
                if (parsed[0].dial) defaultDial = parsed[0].dial;
            }
        } catch (e) {}
    } else if (data.variantMaterial) {
        defaultCase = Array.isArray(data.variantMaterial) ? data.variantMaterial[0] : data.variantMaterial;
    }

    return {
        case: (data.specCase && String(data.specCase).trim()) || defaultCase || "Manufacture Case",
        caseDetails: (data.specCaseDetails && String(data.specCaseDetails).trim()) || "Precision engineered case with scratch-resistant sapphire crystal.",
        dial: (data.specDial && String(data.specDial).trim()) || defaultDial || "Manufacture Dial",
        dialDetails: (data.specDialDetails && String(data.specDialDetails).trim()) || "High-legibility display with luminescent hour markers.",
        movement: (data.specMovement && String(data.specMovement).trim()) || "Mechanical Calibre",
        movementDetails: (data.specMovementDetails && String(data.specMovementDetails).trim()) || "Manufacture self-winding movement with precision power reserve.",
        bracelet: (data.specBracelet && String(data.specBracelet).trim()) || "Integrated Bracelet / Strap",
        braceletDetails: (data.specBraceletDetails && String(data.specBraceletDetails).trim()) || "Manufacture bracelet with secure deployment clasp."
    };
};

import crypto from "crypto";
import path from "path";
import fs from "fs";
import {
    uploadToCloudinary,
    deleteFromCloudinary,
    deleteMultipleFromCloudinary,
    extractPublicIdFromUrl
} from "../../utils/cloudinary.js";

export const processVariantImages = async (images = []) => {
    const urls = [];
    const publicIds = [];

    for (const img of images) {
        if (!img || typeof img !== "string") continue;
        if (img.startsWith("data:image")) {
            const uploadResult = await uploadToCloudinary(img, {
                folder: "delta/products"
            });
            urls.push(uploadResult.url);
            if (uploadResult.publicId) {
                publicIds.push(uploadResult.publicId);
            }
        } else {
            // Already a URL (Cloudinary or local)
            urls.push(img);
            const pubId = extractPublicIdFromUrl(img);
            if (pubId) {
                publicIds.push(pubId);
            }
        }
    }
    return { urls, publicIds };
};

export const saveBase64ImagesToDisk = (images = []) => {
    const savedPaths = [];
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const img of images) {
        if (!img || typeof img !== "string") continue;
        if (img.startsWith("/uploads/") || img.startsWith("http")) {
            savedPaths.push(img);
        } else if (img.startsWith("data:image")) {
            const matches = img.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/) || img.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
            if (matches && matches[2]) {
                const mimeType = matches[1].toLowerCase();
                const isWebp = mimeType.includes("webp");
                const isPng = mimeType.includes("png");
                const ext = isWebp ? "webp" : (isPng ? "png" : "jpg");
                const buffer = Buffer.from(matches[2], "base64");
                const filename = `variant-crop-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
                const filePath = path.join(uploadDir, filename);
                fs.writeFileSync(filePath, buffer);
                savedPaths.push(`/uploads/products/${filename}`);
            }
        }
    }
    return savedPaths;
};

import {
    createProduct,
    findProductById,
    findProductByName,
    findProductByNameExcludingId,
    findProductsWithPagination,
    updateProductById,
    softDeleteProductById,
    restoreProductById,
    toggleProductStatus
} from "../../repositories/product.repository.js";
import { getAllActiveBrands, findBrandById } from "../../repositories/brand.repository.js";
import { ensureDefaultBrandsExist } from "./brand.service.js";
import Product from "../../models/product.model.js";
import { slugify } from "../../utils/slugify.js";
import { getPaginationData } from "../../utils/pagination.js";
import { applyBestOfferToProduct } from "./offer.service.js";


export const generateUniqueReferenceNumber = async (brandId, customRef = '') => {
    if (customRef && String(customRef).trim()) {
        return String(customRef).trim().toUpperCase();
    }

    let prefix = 'DLT';
    if (brandId) {
        const brand = await findBrandById(brandId);
        if (brand) {
            const bName = brand.name.toUpperCase();
            if (bName.includes('ROLEX')) prefix = 'RLX';
            else if (bName.includes('PATEK')) prefix = 'PP';
            else if (bName.includes('AUDEMARS')) prefix = 'AP';
            else if (bName.includes('VACHERON')) prefix = 'VC';
            else if (bName.includes('OMEGA')) prefix = 'OMG';
            else {
                prefix = bName.replace(/[^A-Z]/g, '').substring(0, 3) || 'DLT';
            }
        }
    }

    let refNumber = '';
    let isUnique = false;
    while (!isUnique) {
        const randomDigits = Math.floor(100000 + Math.random() * 900000);
        refNumber = `REF-${prefix}-${randomDigits}`;
        const existing = await Product.findOne({ modelNumber: refNumber, isDeleted: false });
        if (!existing) {
            isUnique = true;
        }
    }
    return refNumber;
};


export const parseVariantsInput = (data = {}) => {
    let rawVariants = [];

    if (data.variantsJson) {
        try {
            rawVariants = typeof data.variantsJson === "string"
                ? JSON.parse(data.variantsJson)
                : data.variantsJson;
        } catch (e) {
            rawVariants = [];
        }
    }

    if ((!Array.isArray(rawVariants) || rawVariants.length === 0) && data.variantColor) {
        const colors = Array.isArray(data.variantColor) ? data.variantColor : [data.variantColor];
        const colorCodes = Array.isArray(data.variantColorCode) ? data.variantColorCode : [data.variantColorCode];
        const materials = Array.isArray(data.variantMaterial) ? data.variantMaterial : [data.variantMaterial];
        const dials = Array.isArray(data.variantDial) ? data.variantDial : [data.variantDial];
        const stocks = Array.isArray(data.variantStock) ? data.variantStock : [data.variantStock];
        const prices = Array.isArray(data.variantPrice) ? data.variantPrice : [data.variantPrice];
        const discountPercentages = Array.isArray(data.variantDiscountPercentage) ? data.variantDiscountPercentage : [data.variantDiscountPercentage];
        const discountPrices = Array.isArray(data.variantDiscountPrice) ? data.variantDiscountPrice : [data.variantDiscountPrice];
        const descriptions = Array.isArray(data.variantDescription) ? data.variantDescription : [data.variantDescription];

        for (let i = 0; i < colors.length; i++) {
            if (colors[i] && String(colors[i]).trim()) {
                rawVariants.push({
                    color: String(colors[i]).trim(),
                    colorCode: colorCodes[i] || "#1b1c1c",
                    material: String(materials[i] || "Oystersteel 904L").trim(),
                    dial: String(dials[i] || "Sunburst Dial").trim(),
                    price: prices[i],
                    discountPercentage: discountPercentages[i],
                    discountPrice: discountPrices[i],
                    stock: stocks[i],
                    description: descriptions[i] || "",
                    images: []
                });
            }
        }
    }

    if (!Array.isArray(rawVariants)) return [];

    const MAX_PRICE = 200000000; 

    const fallbackPrice = (data.price !== undefined && data.price !== null && data.price !== "" && !isNaN(Number(data.price))) 
        ? Math.min(MAX_PRICE, Number(data.price))
        : 1000000;

    const fallbackStock = (data.stock !== undefined && data.stock !== null && data.stock !== "" && !isNaN(parseInt(data.stock, 10)))
        ? parseInt(data.stock, 10)
        : 3;

    return rawVariants.map((v, idx) => {
        let vPrice = (v.price !== undefined && v.price !== null && v.price !== "" && !isNaN(Number(v.price)) && Number(v.price) > 0)
            ? Math.min(MAX_PRICE, Number(v.price))
            : fallbackPrice;

        let vStock = (v.stock !== undefined && v.stock !== null && v.stock !== "" && !isNaN(parseInt(v.stock, 10)) && parseInt(v.stock, 10) >= 0)
            ? parseInt(v.stock, 10)
            : fallbackStock;

        return {
            sku: v.sku || "",
            color: String(v.color || "Standard Edition").trim(),
            colorCode: String(v.colorCode || "#1b1c1c").trim(),
            material: String(v.material || "Oystersteel 904L").trim(),
            dial: String(v.dial || "Sunburst Dial").trim(),
            price: vPrice,
            discountPrice: null,
            stock: vStock,
            description: String(v.description || "").trim(),
            images: Array.isArray(v.images) ? v.images : [],
            isDefault: idx === 0
        };
    });
};


export const getProductsList = async ({
    search = "",
    brandId = "",
    status = "",
    page = 1,
    limit = 10,
    includeDeleted = false
}) => {
    await ensureDefaultBrandsExist();

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * pageLimit;


    const { products, totalProducts } = await findProductsWithPagination({
        search: (search || "").trim(),
        brandId,
        status,
        skip,
        limit: pageLimit,
        sort: {createdAt: -1 },
        includeDeleted: includeDeleted || status === "archived" || status === "deleted"
    });

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
        status
    };
};

export const getProductStats = async () => {
    await ensureDefaultBrandsExist();

    const [totalProducts, activeProducts, outOfStockProducts, deletedProducts] = await Promise.all([
        Product.countDocuments({ isDeleted: false }),
        Product.countDocuments({ isDeleted: false, isActive: true }),
        Product.countDocuments({ isDeleted: false, stock: { $lte: 0 } }),
        Product.countDocuments({ isDeleted: true })
    ]);

    return {
        totalProducts,
        activeProducts,
        outOfStockProducts,
        deletedProducts
    };
};

export const getProductFormData = async () => {
    await ensureDefaultBrandsExist();
    const brands = await getAllActiveBrands();
    return { brands };
};

export const addProduct = async (data, imagePaths = []) => {
    const trimmedName = (data.name || "").trim();
    if (!trimmedName) {
        throw new Error("Timepiece model name is required.");
    }

    if (!data.brand) {
        throw new Error("Manufacture Maison / Brand is required.");
    }

    const existing = await findProductByName(trimmedName);
    if (existing) {
        throw new Error(`A timepiece named "${trimmedName}" already exists in the catalog.`);
    }

    const brandDoc = await findBrandById(data.brand);
    const brandName = brandDoc ? brandDoc.name : (data.brandName || "DELTA Manufacture");

    const finalReferenceNumber = await generateUniqueReferenceNumber(data.brand, data.modelNumber);

    let baseSlug = slugify(trimmedName);
    let slug = baseSlug;
    let counter = 1;
    while (await Product.findOne({ slug, isDeleted: false })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    const parsedVariants = parseVariantsInput(data);
    if (parsedVariants.length === 0) {
        throw new Error("At least one timepiece edition/variant is required.");
    }

    const seenEditionColors = new Set();
    const seenEditionCombos = new Set();
    for (const v of parsedVariants) {
        const colorKey = String(v.color || "").trim().toLowerCase();
        const comboKey = `${colorKey}|${String(v.material || "").trim().toLowerCase()}|${String(v.dial || "").trim().toLowerCase()}`;
        if (colorKey && seenEditionColors.has(colorKey)) {
            throw new Error(`Duplicate variant edition "${v.color}". Each variant edition must have a unique color / title.`);
        }
        if (comboKey && seenEditionCombos.has(comboKey)) {
            throw new Error(`Duplicate variant configuration for "${v.color}". A variant with this exact color, material, and dial already exists.`);
        }
        seenEditionColors.add(colorKey);
        seenEditionCombos.add(comboKey);
    }

    let allSavedVariantImages = [];
    let allVariantPublicIds = [];

    for (const [idx, v] of parsedVariants.entries()) {
        if (v.images && Array.isArray(v.images) && v.images.length > 0) {
            const { urls, publicIds } = await processVariantImages(v.images);
            v.images = urls;
            v.imagePublicIds = publicIds;
            allSavedVariantImages.push(...urls);
            allVariantPublicIds.push(...publicIds);
        } else {
            v.images = [];
            v.imagePublicIds = [];
        }
        if (!v.sku) {
            const colorCodeClean = (v.colorCode || '#1b1c1c').replace('#', '').toUpperCase();
            v.sku = `${finalReferenceNumber}-${colorCodeClean}-${idx + 1}`;
        }
        v.price = Number(v.price) || Number(data.price) || 1000000;
        v.discountPrice = (v.discountPrice !== undefined && v.discountPrice !== null && v.discountPrice !== "") ? Number(v.discountPrice) : null;
        v.stock = parseInt(v.stock, 10) >= 0 ? parseInt(v.stock, 10) : 3;
        v.isDefault = idx === 0;
    }

    const primaryVariant = parsedVariants[0] || {};
    const totalComputedStock = parsedVariants.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0);
    const primaryImages = (primaryVariant.images && primaryVariant.images.length > 0)
        ? primaryVariant.images
        : (imagePaths.length > 0 ? imagePaths : allSavedVariantImages);

    const primaryPublicIds = (primaryVariant.imagePublicIds && primaryVariant.imagePublicIds.length > 0)
        ? primaryVariant.imagePublicIds
        : primaryImages.map(img => extractPublicIdFromUrl(img)).filter(Boolean);

    const totalImagesCount = primaryImages.length > 0 ? primaryImages.length : allSavedVariantImages.length;
    if (totalImagesCount < 3) {
        throw new Error("A minimum of 3 timepiece photos is required across your editions.");
    }
    if (totalImagesCount > 6) {
        throw new Error("A maximum of 6 timepiece photos is allowed across your editions.");
    }

    const product = await createProduct({
        name: trimmedName,
        slug,
        brand: data.brand,
        brandName,
        modelNumber: finalReferenceNumber,
        description: (data.description || "").trim(),
        price: primaryVariant.price,
        discountPrice: null,
        stock: totalComputedStock,
        variants: parsedVariants,
        images: primaryImages.length > 0 ? primaryImages : allSavedVariantImages,
        imagePublicIds: primaryPublicIds.length > 0 ? primaryPublicIds : allVariantPublicIds,
        isFeatured: data.isFeatured === "true" || data.isFeatured === true || data.isFeatured === "on",
        isNewArrival: data.isNewArrival === "true" || data.isNewArrival === true,
        specs: parseSpecsInput(data),
        isActive: data.isActive === undefined ? true : Boolean(data.isActive),
        isDeleted: false
    });

    await applyBestOfferToProduct(product._id);
    return product;
};

export const editProduct = async (id, data, newImagePaths = [], retainedImages = []) => {
    const product = await findProductById(id);
    if (!product || product.isDeleted) {
        throw new Error("Timepiece not found.");
    }

    const trimmedName = (data.name || "").trim();
    if (!trimmedName) {
        throw new Error("Timepiece model name is required.");
    }

    const duplicate = await findProductByNameExcludingId(trimmedName, id);
    if (duplicate) {
        throw new Error(`Another timepiece named "${trimmedName}" already exists.`);
    }

    const brandDoc = await findBrandById(data.brand || product.brand);
    const brandName = brandDoc ? brandDoc.name : product.brandName;

    const finalReferenceNumber = (data.modelNumber && String(data.modelNumber).trim())
        ? String(data.modelNumber).trim().toUpperCase()
        : (product.modelNumber || await generateUniqueReferenceNumber(data.brand || product.brand));

    const parsedVariants = parseVariantsInput(data);
    let allSavedVariantImages = [];
    let allVariantPublicIds = [];

    if (parsedVariants.length > 0) {
        const seenEditionColors = new Set();
        const seenEditionCombos = new Set();
        for (const v of parsedVariants) {
            const colorKey = String(v.color || "").trim().toLowerCase();
            const comboKey = `${colorKey}|${String(v.material || "").trim().toLowerCase()}|${String(v.dial || "").trim().toLowerCase()}`;
            if (colorKey && seenEditionColors.has(colorKey)) {
                throw new Error(`Duplicate variant edition "${v.color}". Each variant edition must have a unique color / title.`);
            }
            if (comboKey && seenEditionCombos.has(comboKey)) {
                throw new Error(`Duplicate variant configuration for "${v.color}". A variant with this exact color, material, and dial already exists.`);
            }
            seenEditionColors.add(colorKey);
            seenEditionCombos.add(comboKey);
        }

        for (const [idx, v] of parsedVariants.entries()) {
            if (v.images && Array.isArray(v.images) && v.images.length > 0) {
                const { urls, publicIds } = await processVariantImages(v.images);
                v.images = urls;
                v.imagePublicIds = publicIds;
                allSavedVariantImages.push(...urls);
                allVariantPublicIds.push(...publicIds);
            } else {
                v.images = [];
                v.imagePublicIds = [];
            }
            if (!v.sku) {
                const colorCodeClean = (v.colorCode || '#1b1c1c').replace('#', '').toUpperCase();
                v.sku = `${finalReferenceNumber}-${colorCodeClean}-${idx + 1}`;
            }
            v.price = Number(v.price) || product.price || 1000000;
            v.discountPrice = (v.discountPrice !== undefined && v.discountPrice !== null && v.discountPrice !== "") ? Number(v.discountPrice) : null;
            v.stock = parseInt(v.stock, 10) >= 0 ? parseInt(v.stock, 10) : 3;
            v.isDefault = idx === 0;
        }
    }

    const effectiveVariants = parsedVariants.length > 0 ? parsedVariants : product.variants;
    const primaryVariant = effectiveVariants[0] || {};
    const totalComputedStock = effectiveVariants.reduce((sum, v) => sum + (parseInt(v.stock, 10) || 0), 0);

    const combinedImages = [...retainedImages, ...newImagePaths, ...allSavedVariantImages];
    const primaryImages = (primaryVariant.images && primaryVariant.images.length > 0)
        ? primaryVariant.images
        : (combinedImages.length > 0 ? combinedImages : product.images);

    const primaryPublicIds = (primaryVariant.imagePublicIds && primaryVariant.imagePublicIds.length > 0)
        ? primaryVariant.imagePublicIds
        : primaryImages.map(img => extractPublicIdFromUrl(img)).filter(Boolean);

    // Track old assets to detect deletions
    const oldAssets = new Set([
        ...(product.images || []),
        ...(product.imagePublicIds || []),
        ...((product.variants || []).flatMap(v => v.images || [])),
        ...((product.variants || []).flatMap(v => v.imagePublicIds || []))
    ]);

    const activeAssets = new Set([
        ...primaryImages,
        ...primaryPublicIds,
        ...combinedImages,
        ...effectiveVariants.flatMap(v => v.images || []),
        ...effectiveVariants.flatMap(v => v.imagePublicIds || [])
    ]);

    const assetsToDelete = [...oldAssets].filter(asset => {
        if (!asset) return false;
        if (activeAssets.has(asset)) return false;
        const pubId = extractPublicIdFromUrl(asset);
        if (pubId && activeAssets.has(pubId)) return false;
        return true;
    });

    if (assetsToDelete.length > 0) {
        await deleteMultipleFromCloudinary(assetsToDelete).catch(err => {
            console.error("Failed to delete removed product images from Cloudinary:", err);
        });
    }

    const updatePayload = {
        name: trimmedName,
        brand: data.brand || product.brand,
        brandName,
        modelNumber: finalReferenceNumber,
        description: (data.description || "").trim(),
        price: primaryVariant.price || Number(data.price) || product.price,
        discountPrice: null,
        stock: totalComputedStock,
        variants: effectiveVariants,
        images: primaryImages.length > 0 ? primaryImages : product.images,
        imagePublicIds: primaryPublicIds.length > 0 ? primaryPublicIds : product.imagePublicIds,
        isFeatured: data.isFeatured !== undefined ? (data.isFeatured === "true" || data.isFeatured === true || data.isFeatured === "on") : product.isFeatured,
        isNewArrival: data.isNewArrival !== undefined ? (data.isNewArrival === "true" || data.isNewArrival === true || data.isNewArrival === "on") : product.isNewArrival,
        specs: parseSpecsInput(data)
    };

    if (trimmedName.toLowerCase() !== product.name.toLowerCase()) {
        let baseSlug = slugify(trimmedName);
        let slug = baseSlug;
        let counter = 1;
        while (await Product.findOne({ _id: { $ne: id }, slug, isDeleted: false })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
        updatePayload.slug = slug;
    }

    if (data.isActive !== undefined) {
        updatePayload.isActive = Boolean(data.isActive);
    }

    const updated = await updateProductById(id, updatePayload);
    await applyBestOfferToProduct(id);
    return updated;
};

export const deleteProduct = async (id) => {
    const product = await findProductById(id);
    if (!product) {
        throw new Error("Timepiece not found.");
    }
    return await softDeleteProductById(id);
};

export const permanentDeleteProduct = async (id) => {
    const product = await findProductById(id);
    if (!product) {
        throw new Error("Timepiece not found.");
    }
    const allImages = [
        ...(product.images || []),
        ...(product.imagePublicIds || []),
        ...((product.variants || []).flatMap(v => v.images || [])),
        ...((product.variants || []).flatMap(v => v.imagePublicIds || []))
    ];
    await deleteMultipleFromCloudinary(allImages).catch(() => {});
    return await Product.findByIdAndDelete(id);
};

export const toggleProduct = async (id) => {
    const product = await findProductById(id);
    if (!product || product.isDeleted) {
        throw new Error("Timepiece not found.");
    }
    return await toggleProductStatus(id);
};

export const restoreProduct = async (id) => {
    const product = await Product.findById(id);
    if (!product) {
        throw new Error("Timepiece not found in archive.");
    }
    return await restoreProductById(id);
};
