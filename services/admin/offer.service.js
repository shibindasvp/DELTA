import Offer from "../../models/offer.model.js";
import Product from "../../models/product.model.js";
import Brand from "../../models/brand.model.js";
import { getPaginationData } from "../../utils/pagination.js";
import { validateOffer } from "../../validations/offer.validation.js";


export const calculateBestOfferForProduct = async (productId, now = new Date()) => {
    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
        return { bestOffer: null, bestPercentage: 0, offerType: null, productOffer: null, brandOffer: null };
    }

    const [productOffers, brandOffers] = await Promise.all([
        Offer.find({
            offerType: "product",
            product: product._id,
            isActive: true,
            isDeleted: false,
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).sort({ discountPercentage: -1 }),
        product.brand
            ? Offer.find({
                  offerType: "brand",
                  brand: product.brand,
                  isActive: true,
                  isDeleted: false,
                  startDate: { $lte: now },
                  endDate: { $gte: now }
              }).sort({ discountPercentage: -1 })
            : []
    ]);

    const bestProductOffer = productOffers.length > 0 ? productOffers[0] : null;
    const bestBrandOffer = brandOffers.length > 0 ? brandOffers[0] : null;

    let bestOffer = null;
    let bestPercentage = 0;
    let offerType = null;

    const prodDiscount = bestProductOffer ? bestProductOffer.discountPercentage : 0;
    const brandDiscount = bestBrandOffer ? bestBrandOffer.discountPercentage : 0;

    if (prodDiscount >= brandDiscount && prodDiscount > 0) {
        bestOffer = bestProductOffer;
        bestPercentage = prodDiscount;
        offerType = "product";
    } else if (brandDiscount > 0) {
        bestOffer = bestBrandOffer;
        bestPercentage = brandDiscount;
        offerType = "brand";
    }

    return {
        bestOffer,
        bestPercentage,
        offerType,
        productOffer: bestProductOffer,
        brandOffer: bestBrandOffer
    };
};


export const applyBestOfferToProduct = async (productId, now = new Date()) => {
    const product = await Product.findById(productId);
    if (!product || product.isDeleted) return null;

    const { bestOffer, bestPercentage } = await calculateBestOfferForProduct(productId, now);

    if (bestOffer && bestPercentage > 0) {
        const effectivePercentage = Math.min(79, bestPercentage);
        product.discountPrice = Math.round(product.price * (1 - effectivePercentage / 100));
        if (product.variants && product.variants.length > 0) {
            product.variants.forEach(variant => {
                const baseVariantPrice = variant.price || product.price;
                variant.discountPrice = Math.round(baseVariantPrice * (1 - effectivePercentage / 100));
            });
        }
    } else {
        product.discountPrice = null;
        if (product.variants && product.variants.length > 0) {
            product.variants.forEach(variant => {
                variant.discountPrice = null;
            });
        }
    }

    await product.save();
    return product;
};


export const recalculateOffersForBrand = async (brandId) => {
    const products = await Product.find({ brand: brandId, isDeleted: false });
    const now = new Date();
    await Promise.all(products.map(p => applyBestOfferToProduct(p._id, now)));
};


export const recalculateOffersForAllProducts = async () => {
    const products = await Product.find({ isDeleted: false });
    const now = new Date();
    for (const p of products) {
        await applyBestOfferToProduct(p._id, now);
    }
};


export const createOffer = async ({
    name,
    description = "",
    offerType,
    discountPercentage,
    productId = null,
    brandId = null,
    startDate,
    endDate
}) => {
   
    const errors = validateOffer({
        name,
        description,
        offerType,
        discountPercentage,
        productId,
        brandId,
        startDate,
        endDate
    });

    if (Object.keys(errors).length > 0) {
        throw new Error(Object.values(errors)[0]);
    }

    const discountNum = Number(discountPercentage);
    const start = new Date(startDate);
    const end = new Date(endDate);

    let verifiedProduct = null;
    let verifiedBrand = null;

    if (offerType === "product") {
        verifiedProduct = await Product.findById(productId);
        if (!verifiedProduct || verifiedProduct.isDeleted) {
            throw new Error("Selected timepiece was not found in the vault catalog.");
        }
    } else if (offerType === "brand") {
        verifiedBrand = await Brand.findById(brandId);
        if (!verifiedBrand || verifiedBrand.isDeleted) {
            throw new Error("Selected Maison brand was not found.");
        }


        const existingBrandOffer = await Offer.findOne({
            offerType: "brand",
            brand: verifiedBrand._id,
            isDeleted: false
        });
        if (existingBrandOffer) {
            throw new Error(`A brand offer for this Maison already exists ("${existingBrandOffer.name}" - ${existingBrandOffer.discountPercentage}% off). Only one offer per brand is allowed.`);
        }
    }

    const offer = new Offer({
        name: name.trim(),
        description: (description || "").trim(),
        offerType,
        discountPercentage: Math.round(discountNum),
        product: verifiedProduct ? verifiedProduct._id : null,
        brand: verifiedBrand ? verifiedBrand._id : null,
        startDate: start,
        endDate: end,
        isActive: true
    });

    await offer.save();

    if (offerType === "product") {
        await applyBestOfferToProduct(verifiedProduct._id);
    } else {
        await recalculateOffersForBrand(verifiedBrand._id);
    }

    return offer;
};


export const updateOffer = async (id, updateData) => {
    const offer = await Offer.findById(id);
    if (!offer || offer.isDeleted) {
        throw new Error("Offer not found.");
    }

    const errors = validateOffer(updateData, { isUpdate: true });
    if (Object.keys(errors).length > 0) {
        throw new Error(Object.values(errors)[0]);
    }

    if (updateData.name !== undefined) {
        offer.name = updateData.name.trim();
    }

    if (updateData.description !== undefined) {
        offer.description = updateData.description.trim();
    }

    if (updateData.discountPercentage !== undefined) {
        offer.discountPercentage = Math.round(Number(updateData.discountPercentage));
    }

    if (updateData.startDate !== undefined) {
        offer.startDate = new Date(updateData.startDate);
    }

    if (updateData.endDate !== undefined) {
        offer.endDate = new Date(updateData.endDate);
    }

    if (offer.endDate <= offer.startDate) {
        throw new Error("Expiration date must be later than the promotional start date.");
    }

    const oldProduct = offer.product;
    const oldBrand = offer.brand;
    const oldType = offer.offerType;

    if (updateData.offerType && ["product", "brand"].includes(updateData.offerType)) {
        offer.offerType = updateData.offerType;
    }

    if (offer.offerType === "product") {
        const targetProductId = updateData.productId || offer.product;
        if (!targetProductId) {
            throw new Error("Please choose a target timepiece from the vault catalog.");
        }
        const product = await Product.findById(targetProductId);
        if (!product || product.isDeleted) {
            throw new Error("Selected timepiece was not found in the vault catalog.");
        }
        offer.product = product._id;
        offer.brand = null;
    } else if (offer.offerType === "brand") {
        const targetBrandId = updateData.brandId || offer.brand;
        if (!targetBrandId) {
            throw new Error("Please choose a target Maison brand for this brand offer.");
        }
        const brand = await Brand.findById(targetBrandId);
        if (!brand || brand.isDeleted) {
            throw new Error("Selected Maison brand was not found.");
        }

        const existingBrandOffer = await Offer.findOne({
            _id: { $ne: offer._id },
            offerType: "brand",
            brand: brand._id,
            isDeleted: false
        });
        if (existingBrandOffer) {
            throw new Error(`A brand offer for this Maison already exists ("${existingBrandOffer.name}" - ${existingBrandOffer.discountPercentage}% off). Only one offer per brand is allowed.`);
        }

        offer.brand = brand._id;
        offer.product = null;
    }

    await offer.save();

    if (oldType === "product" && oldProduct) {
        await applyBestOfferToProduct(oldProduct);
    } else if (oldType === "brand" && oldBrand) {
        await recalculateOffersForBrand(oldBrand);
    }

    if (offer.offerType === "product" && offer.product) {
        await applyBestOfferToProduct(offer.product);
    } else if (offer.offerType === "brand" && offer.brand) {
        await recalculateOffersForBrand(offer.brand);
    }

    return offer;
};


export const toggleOfferStatus = async (id) => {
    const offer = await Offer.findById(id);
    if (!offer || offer.isDeleted) {
        throw new Error("Offer not found.");
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    if (offer.offerType === "product" && offer.product) {
        await applyBestOfferToProduct(offer.product);
    } else if (offer.offerType === "brand" && offer.brand) {
        await recalculateOffersForBrand(offer.brand);
    }

    return offer;
};


export const deleteOffer = async (id) => {
    const offer = await Offer.findById(id);
    if (!offer || offer.isDeleted) {
        throw new Error("Offer not found.");
    }

    offer.isDeleted = true;
    offer.isActive = false;
    await offer.save();

    if (offer.offerType === "product" && offer.product) {
        await applyBestOfferToProduct(offer.product);
    } else if (offer.offerType === "brand" && offer.brand) {
        await recalculateOffersForBrand(offer.brand);
    }

    return offer;
};


export const getOfferById = async (id) => {
    const offer = await Offer.findOne({ _id: id, isDeleted: false })
        .populate("product", "name price discountPrice images modelNumber")
        .populate("brand", "name slug logo");
    return offer;
};


export const getOffersList = async ({
    search = "",
    type = "all",
    status = "all",
    sort = "newest",
    page = 1,
    limit = 10
}) => {
    const query = { isDeleted: false };
    const now = new Date();

    if (type && type !== "all") {
        query.offerType = type;
    }

    if (status === "active") {
        query.isActive = true;
        query.startDate = { $lte: now };
        query.endDate = { $gte: now };
    } else if (status === "inactive") {
        query.isActive = false;
    } else if (status === "expired") {
        query.endDate = { $lt: now };
    }

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        const [matchingProducts, matchingBrands] = await Promise.all([
            Product.find({ name: regex, isDeleted: false }).select("_id"),
            Brand.find({ name: regex, isDeleted: false }).select("_id")
        ]);

        query.$or = [
            { name: regex },
            { description: regex },
            { product: { $in: matchingProducts.map(p => p._id) } },
            { brand: { $in: matchingBrands.map(b => b._id) } }
        ];
    }

    let sortObj = { createdAt: -1 };
    if (sort === "oldest") sortObj = { createdAt: 1 };
    else if (sort === "discount_high") sortObj = { discountPercentage: -1 };
    else if (sort === "discount_low") sortObj = { discountPercentage: 1 };
    else if (sort === "expiring_soon") sortObj = { endDate: 1 };

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (currentPage - 1) * pageLimit;

    const [offers, totalOffers, statsData, allProducts, allBrands] = await Promise.all([
        Offer.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(pageLimit)
            .populate("product", "name price discountPrice images modelNumber")
            .populate("brand", "name slug logo"),
        Offer.countDocuments(query),
        Offer.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$isActive", true] },
                                        { $lte: ["$startDate", now] },
                                        { $gte: ["$endDate", now] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    productCount: {
                        $sum: { $cond: [{ $eq: ["$offerType", "product"] }, 1, 0] }
                    },
                    brandCount: {
                        $sum: { $cond: [{ $eq: ["$offerType", "brand"] }, 1, 0] }
                    }
                }
            }
        ]),
        Product.find({ isDeleted: false, isActive: true })
            .select("name price modelNumber images brand")
            .populate("brand", "name")
            .sort({ name: 1 }),
        Brand.find({ isDeleted: false, isActive: true })
            .select("name slug logo")
            .sort({ name: 1 })
    ]);

    const stats = statsData.length > 0 ? statsData[0] : { total: 0, active: 0, productCount: 0, brandCount: 0 };
    delete stats._id;

    const existingBrandOffers = await Offer.find({
        offerType: "brand",
        isDeleted: false
    }).select("brand name discountPercentage");

    const brandOfferMap = new Map();
    existingBrandOffers.forEach(o => {
        if (o.brand) {
            brandOfferMap.set(o.brand.toString(), {
                offerId: o._id.toString(),
                offerName: o.name,
                discountPercentage: o.discountPercentage
            });
        }
    });

    const enhancedBrands = allBrands.map(b => {
        const bObj = b.toObject ? b.toObject() : b;
        const existing = brandOfferMap.get(b._id.toString());
        return {
            ...bObj,
            hasOffer: Boolean(existing),
            existingOffer: existing || null
        };
    });

    const pagination = getPaginationData({
        page: currentPage,
        limit: pageLimit,
        totalItems: totalOffers
    });
    pagination.page = currentPage;
    pagination.limit = pageLimit;
    pagination.totalOffers = totalOffers;

    return {
        offers,
        allProducts,
        allBrands: enhancedBrands,
        stats,
        pagination
    };
};
