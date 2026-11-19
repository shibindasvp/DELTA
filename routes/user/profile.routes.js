import express from "express";

import {
    isAuthenticated,
    preventCache
} from "../../middlewares/auth.middleware.js";

import {
    handleProfileUpload,
    processAndResizeProfileImage
} from "../../middlewares/upload.middleware.js";

import {
    showProfile,
    showEditProfile,
    editProfile,
    showChangePassword,
    changeUserPassword,
    showChangeEmail,
    showVerifyEmail,
    requestEmailChange,
    verifyNewEmail,
    resendEmailOTP
} from "../../controllers/user/profile.controller.js";

const router = express.Router();




router.get(
    "/profile",
    isAuthenticated,
    preventCache,
    showProfile
);




router.get(
    "/profile/edit",
    isAuthenticated,
    preventCache,
    showEditProfile
);

router.post(
    "/profile/edit",
    isAuthenticated,
    handleProfileUpload,
    processAndResizeProfileImage,
    editProfile
);




router.get(
    "/profile/change-password",
    isAuthenticated,
    preventCache,
    showChangePassword
);

router.post(
    "/profile/change-password",
    isAuthenticated,
    changeUserPassword
);




router.get(
    "/profile/change-email",
    isAuthenticated,
    preventCache,
    showChangeEmail
);

router.get(
    "/profile/edit-email",
    isAuthenticated,
    preventCache,
    showChangeEmail
);

router.get(
    "/profile/verify-email",
    isAuthenticated,
    preventCache,
    showVerifyEmail
);

router.post(
    "/profile/change-email",
    isAuthenticated,
    requestEmailChange
);

router.post(
    "/profile/verify-email",
    isAuthenticated,
    verifyNewEmail
);

router.post(
    "/profile/resend-email-otp",
    isAuthenticated,
    resendEmailOTP
);


export default router;