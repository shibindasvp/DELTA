import {
    createBrand,
    findBrandById,
    findBrandByName,
    findBrandByNameExcludingId,
    findBrandsWithPagination,
    updateBrandById,
    softDeleteBrandById,
    hardDeleteBrandById,
    restoreBrandById,
    toggleBrandStatus,
    getAllActiveBrands
} from "../../repositories/brand.repository.js";
import Brand from "../../models/brand.model.js";
import Product from "../../models/product.model.js";
import { slugify } from "../../utils/slugify.js";
import { getPaginationData } from "../../utils/pagination.js";
import { deleteFromCloudinary } from "../../utils/cloudinary.js";


const DEFAULT_MAISONS = [
    {
        name: "Rolex",
        slug: "rolex",
        origin: "Geneva, Switzerland",
        foundedYear: 1905,
        description: "Founded in 1905, Rolex has become the ultimate symbol of performance and prestige.",
        isActive: true,
        isDeleted: false
    },
    {
        name: "Patek Philippe",
        slug: "patek-philippe",
        origin: "Geneva, Switzerland",
        foundedYear: 1839,
        description: "The last family-owned independent Genevan watch manufacturer. Renowned for...",
        isActive: true,
        isDeleted: false
    },
    {
        name: "Audemars Piguet",
        slug: "audemars-piguet",
        origin: "Le Brassus, Switzerland",
        foundedYear: 1875,
        description: "Pioneers of Haute Horlogerie since 1875. Best known for the Royal Oak, the first luxury steel...",
        isActive: true,
        isDeleted: false
    },
    {
        name: "Vacheron Constantin",
        slug: "vacheron-constantin",
        origin: "Geneva, Switzerland",
        foundedYear: 1755,
        description: "The world's oldest watch manufacture in continuous production since 1755...",
        isActive: true,
        isDeleted: false
    },
    {
        name: "Omega",
        slug: "omega",
        origin: "Biel/Bienne, Switzerland",
        foundedYear: 1848,
        description: "From the Moon to the deep sea, Omega has defined chronometric precision. Famous...",
        isActive: true,
        isDeleted: false
    }
];

export const ensureDefaultBrandsExist = async () => {
    for (const maison of DEFAULT_MAISONS) {
        const existing = await Brand.findOne({
            $or: [{ slug: maison.slug }, { name: maison.name }]
        });
        if (!existing) {
            await Brand.create(maison);
        }
    }
};

export const getBrandsList = async ({
    search = "",
    page = 1,
    limit = 10,
    status = "all",
    includeDeleted = false
}) => {

    await ensureDefaultBrandsExist();

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * pageLimit;

  
    const { brands, totalBrands } = await findBrandsWithPagination({
        search: (search || "").trim(),
        skip,
        limit: pageLimit,
        sort: { createdAt: -1 },
        status,
        includeDeleted
    });

    const pagination = getPaginationData({
        page: currentPage,
        limit: pageLimit,
        totalItems: totalBrands
    });

    return {
        brands,
        pagination,
        search: (search || "").trim(),
        status
    };
};

export const getBrandStats = async () => {
    await ensureDefaultBrandsExist();

    const [totalBrands, activeBrands, unlistedBrands, deletedBrands] = await Promise.all([
        Brand.countDocuments({ isDeleted: false }),
        Brand.countDocuments({ isDeleted: false, isActive: true }),
        Brand.countDocuments({ isDeleted: false, isActive: false }),
        Brand.countDocuments({ isDeleted: true })
    ]);

    return {
        totalBrands,
        activeBrands,
        unlistedBrands,
        deletedBrands
    };
};

export const addBrand = async ({ name, origin, foundedYear, description, website, isActive = true, logo = "", logoPublicId = "" }) => {
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
        throw new Error("Brand name is required.");
    }

    const existing = await findBrandByName(trimmedName);
    if (existing) {
        throw new Error(`A brand named "${trimmedName}" already exists.`);
    }

    let baseSlug = slugify(trimmedName);
    let slug = baseSlug;
    let counter = 1;
    while (await Brand.findOne({ slug, isDeleted: false })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    return await createBrand({
        name: trimmedName,
        slug,
        origin: (origin || "Switzerland").trim(),
        foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
        description: (description || "").trim(),
        website: (website || "").trim(),
        logo: logo || "",
        logoPublicId: logoPublicId || "",
        isActive: Boolean(isActive),
        isDeleted: false
    });
};

export const editBrand = async (id, { name, origin, foundedYear, description, website, isActive, logo, logoPublicId }) => {
    const brand = await findBrandById(id);
    if (!brand || brand.isDeleted) {
        throw new Error("Brand not found.");
    }

    const trimmedName = (name || "").trim();
    if (!trimmedName) {
        throw new Error("Brand name is required.");
    }

    const duplicate = await findBrandByNameExcludingId(trimmedName, id);
    if (duplicate) {
        throw new Error(`Another brand named "${trimmedName}" already exists.`);
    }

    const updatePayload = {
        name: trimmedName,
        origin: (origin || "Switzerland").trim(),
        foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
        description: (description || "").trim(),
        website: (website || "").trim()
    };

    if (logo) {
        // If replacing old logo, clean up from Cloudinary
        if (brand.logoPublicId || brand.logo) {
            await deleteFromCloudinary(brand.logoPublicId || brand.logo).catch(err => {
                console.error("Failed to delete previous brand logo from Cloudinary:", err);
            });
        }
        updatePayload.logo = logo;
        updatePayload.logoPublicId = logoPublicId || "";
    }

    if (trimmedName.toLowerCase() !== brand.name.toLowerCase()) {
        let baseSlug = slugify(trimmedName);
        let slug = baseSlug;
        let counter = 1;
        while (await Brand.findOne({ _id: { $ne: id }, slug, isDeleted: false })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
        updatePayload.slug = slug;
    }

    if (isActive !== undefined) {
        updatePayload.isActive = Boolean(isActive);
    }

    return await updateBrandById(id, updatePayload);
};

export const deleteBrand = async (id) => {
    const brand = await findBrandById(id);
    if (!brand) {
        throw new Error("Brand not found.");
    }
    return await softDeleteBrandById(id);
};

export const permanentDeleteBrand = async (id, { cascade = true } = {}) => {
    const brand = await findBrandById(id);
    if (!brand) {
        throw new Error("Brand not found.");
    }

    if (!cascade) {
        const linkedProductsCount = await Product.countDocuments({ brand: id, isDeleted: false });
        if (linkedProductsCount > 0) {
            throw new Error(`Cannot delete "${brand.name}". There are ${linkedProductsCount} active timepiece(s) linked to this Maison.`);
        }
    }

    // Clean up any linked products and their Cloudinary images
    const linkedProducts = await Product.find({ brand: id }).lean();
    for (const prod of linkedProducts) {
        const prodImages = [...(prod.images || []), ...(prod.imagePublicIds || [])];
        if (prod.variants) {
            prod.variants.forEach(v => {
                if (v.images) prodImages.push(...v.images);
                if (v.imagePublicIds) prodImages.push(...v.imagePublicIds);
            });
        }
        for (const img of prodImages) {
            await deleteFromCloudinary(img).catch(() => {});
        }
    }
    await Product.deleteMany({ brand: id });

    // Delete brand logo from Cloudinary
    if (brand.logoPublicId || brand.logo) {
        await deleteFromCloudinary(brand.logoPublicId || brand.logo).catch(err => {
            console.error("Failed to delete brand logo from Cloudinary:", err);
        });
    }

    return await hardDeleteBrandById(id);
};

export const permanentDeleteAllArchivedBrands = async () => {
    const archivedBrands = await Brand.find({ isDeleted: true }).lean();
    if (!archivedBrands || archivedBrands.length === 0) {
        return { deletedCount: 0, deletedBrandNames: [] };
    }

    const archivedBrandIds = archivedBrands.map(b => b._id);
    const deletedBrandNames = archivedBrands.map(b => b.name);

    // Clean up any products associated with these archived brands and their images
    const linkedProducts = await Product.find({ brand: { $in: archivedBrandIds } }).lean();
    for (const prod of linkedProducts) {
        const prodImages = [...(prod.images || []), ...(prod.imagePublicIds || [])];
        if (prod.variants) {
            prod.variants.forEach(v => {
                if (v.images) prodImages.push(...v.images);
                if (v.imagePublicIds) prodImages.push(...v.imagePublicIds);
            });
        }
        for (const img of prodImages) {
            await deleteFromCloudinary(img).catch(() => {});
        }
    }
    await Product.deleteMany({ brand: { $in: archivedBrandIds } });

    // Clean up logos from Cloudinary
    for (const b of archivedBrands) {
        if (b.logoPublicId || b.logo) {
            await deleteFromCloudinary(b.logoPublicId || b.logo).catch(() => {});
        }
    }

    // Permanently remove all archived brands from Brand collection
    const result = await Brand.deleteMany({ _id: { $in: archivedBrandIds } });

    return {
        deletedCount: result.deletedCount || archivedBrands.length,
        deletedBrandNames
    };
};

export const restoreBrand = async (id) => {
    const brand = await findBrandById(id);
    if (!brand) {
        throw new Error("Brand not found.");
    }
    return await restoreBrandById(id);
};

export const toggleBrand = async (id) => {
    const brand = await findBrandById(id);
    if (!brand || brand.isDeleted) {
        throw new Error("Brand not found.");
    }
    return await toggleBrandStatus(id);
};

export const getActiveBrands = async () => {
    await ensureDefaultBrandsExist();
    return await getAllActiveBrands();
};
