import {
    getInventoryList,
    getInventoryStats,
    updateProductStock,
    bulkUpdateProductStock,
    getInventoryExportData
} from "../../services/admin/inventory.service.js";
import { getAllActiveBrands } from "../../repositories/brand.repository.js";
import { AppError, isAjaxRequest, respondWithError } from "../../utils/error.js";


export const showInventory = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const brandId = req.query.brand || "";
        const stockStatus = req.query.stockStatus || "all";
        const sortBy = req.query.sortBy || "updated_desc";
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;

        const [{ products, pagination }, stats, brands] = await Promise.all([
            getInventoryList({ search, brandId, stockStatus, sortBy, page, limit }),
            getInventoryStats(),
            getAllActiveBrands()
        ]);

        const flashSuccess = req.query.updated === "true"
            ? "Vault stock allocation updated successfully."
            : req.query.bulk === "true"
            ? "Bulk inventory rebalance applied successfully."
            : null;

        const flashError = req.query.error || null;

        res.render("admin/inventory/index", {
            products,
            pagination,
            search,
            brandId,
            stockStatus,
            sortBy,
            stats,
            brands,
            success: flashSuccess,
            error: flashError,
            activePage: "inventory",
            admin: req.admin || res.locals.currentAdmin
        });
    } catch (error) {
        next(error);
    }
};


export const updateStockHandler = async (req, res, next) => {
    try {
        const productId = req.params.productId || req.body.productId;
        const variantId = req.body.variantId || null;
        const newStock = req.body.newStock !== undefined ? req.body.newStock : req.body.stock;
        const adjustmentType = req.body.adjustmentType || "set";
        const reason = req.body.reason || "Manual Vault Adjustment";
        const adminName = req.admin ? (req.admin.name || req.admin.email) : "Vault Administrator";

        const result = await updateProductStock({
            productId,
            variantId,
            newStock,
            adjustmentType,
            reason,
            adminName
        });

        const isAjax = req.xhr || 
            req.headers.accept?.includes("application/json") || 
            req.body.isAjax === "true" || 
            req.body.isAjax === true;

        if (isAjax) {
            return res.json({
                success: true,
                message: `Stock updated successfully to ${result.totalStock} units.`,
                data: {
                    productId: result.product._id,
                    variantId: result.updatedVariant ? result.updatedVariant._id : null,
                    totalStock: result.totalStock,
                    variantStock: result.variantStock,
                    status: result.status
                }
            });
        }

        const search = req.query.search || req.body.search || "";
        const brand = req.query.brand || req.body.brand || "";
        const stockStatus = req.query.stockStatus || req.body.stockStatus || "all";
        const sortBy = req.query.sortBy || req.body.sortBy || "updated_desc";
        const page = req.query.page || req.body.page || 1;
        const limit = req.query.limit || req.body.limit || 10;

        res.redirect(`/admin/inventory?updated=true&search=${encodeURIComponent(search)}&brand=${brand}&stockStatus=${stockStatus}&sortBy=${sortBy}&page=${page}&limit=${limit}`);
    } catch (error) {
        const isAjax = isAjaxRequest(req) || req.body.isAjax === "true" || req.body.isAjax === true;
        const search = req.query.search || req.body.search || "";
        const brand = req.query.brand || req.body.brand || "";
        const stockStatus = req.query.stockStatus || req.body.stockStatus || "all";
        const sortBy = req.query.sortBy || req.body.sortBy || "updated_desc";
        const page = req.query.page || req.body.page || 1;
        const limit = req.query.limit || req.body.limit || 10;

        return respondWithError(req, res, error, {
            fallback: "Failed to update stock. Please verify the quantity and try again.",
            redirectUrl: isAjax ? null : `/admin/inventory?search=${encodeURIComponent(search)}&brand=${brand}&stockStatus=${stockStatus}&sortBy=${sortBy}&page=${page}&limit=${limit}`
        });
    }
};


export const bulkUpdateStockHandler = async (req, res, next) => {
    try {
        let updates = req.body.updates;
        if (typeof updates === "string") {
            try {
                updates = JSON.parse(updates);
            } catch (e) {
                throw new AppError("Invalid bulk stock update payload. Please refresh the page and try again.", 400);
            }
        }

        const results = await bulkUpdateProductStock(updates);

        const isAjax = req.xhr || req.headers.accept?.includes("application/json") || req.body.isAjax === "true";
        if (isAjax) {
            return res.json({
                success: true,
                message: "Bulk vault stock update processed.",
                results
            });
        }

        res.redirect("/admin/inventory?bulk=true");
    } catch (error) {
        const isAjax = isAjaxRequest(req) || req.body.isAjax === "true" || req.body.isAjax === true;
        return respondWithError(req, res, error, {
            fallback: "Bulk stock update failed. Please review your quantities and try again.",
            redirectUrl: isAjax ? null : "/admin/inventory"
        });
    }
};


export const exportInventoryCSV = async (req, res, next) => {
    try {
        const rows = await getInventoryExportData();
        const dateStr = new Date().toISOString().split("T")[0];
        
        let csvContent = "Reference,Model Name,Manufacture Maison,Variant Edition,SKU,Case Material,Dial,Unit Price (INR),Vault Stock,Asset Valuation (INR),Stock Health Status\n";

        rows.forEach(r => {
            const escapedModel = `"${(r.model || '').replace(/"/g, '""')}"`;
            const escapedBrand = `"${(r.brand || '').replace(/"/g, '""')}"`;
            const escapedVariant = `"${(r.variant || '').replace(/"/g, '""')}"`;
            const escapedMaterial = `"${(r.material || '').replace(/"/g, '""')}"`;
            const escapedDial = `"${(r.dial || '').replace(/"/g, '""')}"`;

            csvContent += `${r.reference},${escapedModel},${escapedBrand},${escapedVariant},${r.sku},${escapedMaterial},${escapedDial},${r.unitPrice},${r.stock},${r.totalValuation},${r.status}\n`;
        });

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=DELTA_Maison_Inventory_${dateStr}.csv`);
        res.status(200).send(csvContent);
    } catch (error) {
        next(error);
    }
};
