import express from "express";

import {
    showVerifyOTP,
    verifySignupOTP,
    verifyForgotOTP,
    verifyGoogleOTP,
    resendOTP
} from "../../controllers/user/otp.controller.js";

const router = express.Router();


router.get("/verify-otp", showVerifyOTP);
router.get("/otp/verify", showVerifyOTP);


router.post("/verify-otp", (req, res, next) => {
    const purpose = req.body.purpose || "signup";
    if (purpose === "forgot-password") {
        return verifyForgotOTP(req, res, next);
    }
    if (purpose === "google-signin") {
        return verifyGoogleOTP(req, res, next);
    }
    return verifySignupOTP(req, res, next);
});

router.post("/otp/signup/verify", verifySignupOTP);
router.post("/otp/forgot-password/verify", verifyForgotOTP);
router.post("/otp/google-signin/verify", verifyGoogleOTP);


router.post("/resend-otp", resendOTP);
router.post("/otp/resend", resendOTP);

export default router;
