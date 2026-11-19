import Product from "../../models/product.model.js";
import Brand from "../../models/brand.model.js";
import { ensureDefaultBrandsExist } from "../../services/admin/brand.service.js";

export const showUserBrands = async (req, res, next) => {
    try {
        await ensureDefaultBrandsExist();
        const brands = await Brand.find({ isDeleted: false, isActive: true }).sort({ createdAt: 1 }).lean();
        

        const brandCollections = await Promise.all(
            brands.map(async (b) => {
                const products = await Product.find({
                    brand: b._id,
                    isDeleted: false,
                    isActive: true
                })
                .sort({ createdAt: -1 })
                .limit(4)
                .lean();

                return {
                    ...b,
                    products
                };
            })
        );

        res.render("user/brands/index", {
            user: req.user || res.locals.currentUser || null,
            brandCollections,
            activeNav: "brands",
            title: "Swiss Maisons & Complete Collection — DELTA"
        });
    } catch (error) {
        next(error);
    }
};
