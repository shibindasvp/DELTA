import Product from "../../models/product.model.js";
import Brand from "../../models/brand.model.js";
import { LUXURY_BRANDS } from "../../utils/constants.js";

export const showHome = async (req, res, next) => {
    try {
        const [dbProducts, dbBrands] = await Promise.all([
            Product.find({ isActive: true, isDeleted: false })
                .populate("brand")
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(10),
            Brand.find({ isDeleted: false, isActive: true }).limit(10)
        ]);

        const rawBrands = dbBrands.length > 0 ? dbBrands : LUXURY_BRANDS;

        // Fetch a representative product for each brand so "The Great Maisons" display actual catalog photos
        const brands = await Promise.all(
            rawBrands.map(async (b) => {
                const brandObj = b.toObject ? b.toObject() : { ...b };
                if (b._id) {
                    const sampleProduct = await Product.findOne({
                        brand: b._id,
                        isActive: true,
                        isDeleted: false
                    })
                    .sort({ isFeatured: -1, createdAt: -1 })
                    .lean();

                    brandObj.featuredProduct = sampleProduct || null;
                }
                return brandObj;
            })
        );

        res.render("user/home/home", {
            user: req.user || res.locals.currentUser || null,
            brands,
            featuredWatches: dbProducts,
            activeNav: "home"
        });
    } catch (error) {
        next(error);
    }
};
