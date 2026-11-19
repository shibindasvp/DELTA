import express from "express";

import {
    isAuthenticated,
    preventCache
} from "../../middlewares/auth.middleware.js";

import {
    showAddresses,
    showAddAddress,
    addNewAddress,
    showEditAddress,
    updateExistingAddress,
    deleteExistingAddress,
    setDefaultAddressHandler,
    getPincodeDetails
} from "../../controllers/user/address.controller.js";

const router = express.Router();


router.get("/addresses/pincode/:pincode", getPincodeDetails);
router.get("/api/pincode/:pincode", getPincodeDetails);



router.get(
    "/addresses",
    isAuthenticated,
    preventCache,
    showAddresses
);

router.get(
    "/profile/addresses",
    isAuthenticated,
    preventCache,
    showAddresses
);



router.get(
    "/addresses/add",
    isAuthenticated,
    preventCache,
    showAddAddress
);

router.get(
    "/profile/addresses/add",
    isAuthenticated,
    preventCache,
    showAddAddress
);

router.post(
    "/addresses/add",
    isAuthenticated,
    addNewAddress
);

router.post(
    "/profile/addresses",
    isAuthenticated,
    addNewAddress
);



router.get(
    ["/addresses/:id/edit", "/addresses/edit/:id"],
    isAuthenticated,
    preventCache,
    showEditAddress
);

router.get(
    ["/profile/addresses/:id/edit", "/profile/addresses/edit/:id"],
    isAuthenticated,
    preventCache,
    showEditAddress
);

router.post(
    ["/addresses/:id/edit", "/addresses/edit/:id"],
    isAuthenticated,
    updateExistingAddress
);

router.post(
    ["/profile/addresses/:id/edit", "/profile/addresses/edit/:id"],
    isAuthenticated,
    updateExistingAddress
);




router.post(
    ["/addresses/:id/set-default", "/addresses/set-default/:id"],
    isAuthenticated,
    setDefaultAddressHandler
);

router.post(
    ["/profile/addresses/:id/set-default", "/profile/addresses/set-default/:id"],
    isAuthenticated,
    setDefaultAddressHandler
);




router.post(
    "/addresses/:id/delete",
    isAuthenticated,
    deleteExistingAddress
);

router.post(
    "/profile/addresses/:id/delete",
    isAuthenticated,
    deleteExistingAddress
);


export default router;