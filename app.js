import "dotenv/config";

import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import {
    fileURLToPath
} from "url";
import helmet from "helmet";

import connectDB from "./config/db.js";

import authRoutes from "./routes/user/auth.routes.js";
import homeRoutes from "./routes/user/home.routes.js";
import shopRoutes from "./routes/user/shop.routes.js";
import userBrandRoutes from "./routes/user/brand.routes.js";
import cartRoutes from "./routes/user/cart.routes.js";
import wishlistRoutes from "./routes/user/wishlist.routes.js";
import otpRoutes from "./routes/user/otp.routes.js";
import profileRoutes from "./routes/user/profile.routes.js";
import addressRoutes from "./routes/user/address.routes.js";
import checkoutRoutes from "./routes/user/checkout.routes.js";
import walletRoutes from "./routes/user/wallet.routes.js";

import adminAuthRoutes from "./routes/admin/auth.routes.js";
import adminDashboardRoutes from "./routes/admin/dashboard.routes.js";
import adminUserRoutes from "./routes/admin/user.routes.js";
import adminBrandRoutes from "./routes/admin/brand.routes.js";
import adminProductRoutes from "./routes/admin/product.routes.js";
import adminInventoryRoutes from "./routes/admin/inventory.routes.js";
import adminOrderRoutes from "./routes/admin/order.routes.js";
import adminCouponRoutes from "./routes/admin/coupon.routes.js";
import adminOfferRoutes from "./routes/admin/offer.routes.js";
import adminReportRoutes from "./routes/admin/report.routes.js";
import adminReviewRoutes from "./routes/admin/review.routes.js";
import adminCategoryRoutes from "./routes/admin/category.routes.js";
import adminBannerRoutes from "./routes/admin/banner.routes.js";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware.js";

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const app = express();

const PORT =
    process.env.PORT || 3035;


app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: false,
        crossOriginEmbedderPolicy: false,
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        originAgentCluster: false
    })
);


app.use(
    express.json({
        limit: "50mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "50mb",
        parameterLimit: 100000
    })
);


app.use(cookieParser());

app.use(
    session({
        secret: process.env.SESSION_SECRET || "delta_vault_luxury_secret_session_key_2026",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);


app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


app.set(
    "view engine",
    "ejs"
);

app.set(
    "views",
    path.join(
        __dirname,
        "views"
    )
);


app.use(
    "/",
    homeRoutes
);

app.use(
    "/",
    userBrandRoutes
);

app.use(
    "/",
    shopRoutes
);

app.use(
    "/",
    cartRoutes
);

app.use(
    "/",
    wishlistRoutes
);

app.use(
    "/",
    authRoutes
);

app.use(
    "/",
    otpRoutes
);

app.use(
    "/",
    profileRoutes
);

app.use(
    "/",
    addressRoutes
);

app.use(
    "/",
    checkoutRoutes
);

app.use(
    "/",
    walletRoutes
);


// Admin Routes
app.use(
    "/admin",
    adminAuthRoutes
);

app.use(
    "/admin",
    adminDashboardRoutes
);

app.use(
    "/admin",
    adminUserRoutes
);


app.use(
    "/admin",
    adminBrandRoutes
);

app.use(
    "/admin",
    adminProductRoutes
);

app.use(
    "/admin",
    adminInventoryRoutes
);

app.use(
    "/admin",
    adminOrderRoutes
);

app.use(
    "/admin",
    adminCouponRoutes
);

app.use(
    "/admin",
    adminOfferRoutes
);

app.use(
    "/admin",
    adminReportRoutes
);

app.use(
    "/admin",
    adminReviewRoutes
);

app.use(
    "/admin",
    adminCategoryRoutes
);

app.use(
    "/admin",
    adminBannerRoutes
);


app.use(notFoundHandler);
app.use(errorHandler);

const startServer =
    async () => {
        try {
            await connectDB();

            if (process.env.RUN_AUTH_TESTS === "true") {
                try {
                    const { runAuthProfileTestSuite } = await import("./tests/verify-auth-profile-suite.js");
                    await runAuthProfileTestSuite();
                } catch (testErr) {
                    console.error("Test suite execution failed:", testErr);
                }
            }
        
            app.listen(
                PORT,
                () => {
                    console.log(
                        `DELTA server running on http://localhost:${PORT}`
                    );
                }
            );
        } catch (error) {
            console.error(
                "Failed to start server:",
                error
            );

            process.exit(1);
        }
    };

startServer();

export default app;