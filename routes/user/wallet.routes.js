import express from "express";
import {
    showWallet,
    getWalletBalanceApi,
    initiateAddMoneyHandler,
    verifyAddMoneyHandler
} from "../../controllers/user/wallet.controller.js";
import { isAuthenticated, preventCache } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/wallet", isAuthenticated, preventCache, showWallet);
router.get("/profile/wallet", isAuthenticated, preventCache, showWallet);
router.get("/api/wallet/balance", isAuthenticated, getWalletBalanceApi);


router.post("/wallet/add-money/create-order", isAuthenticated, initiateAddMoneyHandler);
router.post("/wallet/add-money/verify", isAuthenticated, verifyAddMoneyHandler);

export default router;
