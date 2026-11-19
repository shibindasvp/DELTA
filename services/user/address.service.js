import {
    findAddressesByUser,
    findAddressById,
    createAddress,
    updateAddress,
    deleteAddress,
    unsetDefaultAddresses
} from "../../repositories/address.repository.js";

export const getAddresses = async (
    userId
) => {
    return await findAddressesByUser(userId);
};

export const getAddressById = async (
    addressId,
    userId
) => {
    const address =
        await findAddressById(
            addressId,
            userId
        );

    if (!address) {
        throw new Error(
            "Address not found or unauthorized."
        );
    }

    return address;
};

export const addAddress = async (
    userId,
    data
) => {
    const isDefault =
        data.isDefault === true ||
        data.isDefault === "true" ||
        data.isDefault === "on";

    const existingAddresses =
        await findAddressesByUser(userId);

    if (isDefault) {
        await unsetDefaultAddresses(
            userId
        );
    }

    return await createAddress({
        userId,
        fullName: (
            data.fullName ||
            data.name ||
            ""
        ).trim(),
        phone: (
            data.phone || ""
        ).trim(),
        addressLine: (
            data.addressLine ||
            data.address ||
            ""
        ).trim(),
        city: (
            data.city || ""
        ).trim(),
        state: (
            data.state || ""
        ).trim(),
        pincode: (
            data.pincode || ""
        ).trim(),
        country: (
            data.country ||
            "India"
        ).trim(),
        addressType:
            data.addressType ||
            "home",
        isDefault:
            isDefault ||
            existingAddresses.length === 0
    });
};

export const editAddress = async (
    userId,
    addressId,
    data
) => {
    const existing =
        await findAddressById(
            addressId,
            userId
        );

    if (!existing) {
        throw new Error(
            "Address not found or unauthorized access."
        );
    }

    const isDefault =
        data.isDefault === true ||
        data.isDefault === "true" ||
        data.isDefault === "on";

    if (isDefault) {
        await unsetDefaultAddresses(
            userId
        );
    }

    return await updateAddress(
        addressId,
        userId,
        {
            fullName: (
                data.fullName ||
                data.name ||
                ""
            ).trim(),

            phone: (
                data.phone || ""
            ).trim(),

            addressLine: (
                data.addressLine ||
                data.address ||
                ""
            ).trim(),

            city: (
                data.city || ""
            ).trim(),

            state: (
                data.state || ""
            ).trim(),

            pincode: (
                data.pincode || ""
            ).trim(),

            country: (
                data.country ||
                "India"
            ).trim(),

            addressType:
                data.addressType ||
                "home",

            isDefault
        }
    );
};

export const removeAddress = async (
    userId,
    addressId
) => {
    const deleted =
        await deleteAddress(
            addressId,
            userId
        );

    if (!deleted) {
        throw new Error(
            "Address not found or unauthorized access."
        );
    }

    if (deleted.isDefault) {
        const remaining =
            await findAddressesByUser(
                userId
            );

        if (remaining.length > 0) {
            await updateAddress(
                remaining[0]._id,
                userId,
                {
                    isDefault: true
                }
            );
        }
    }

    return true;
};

export const setDefaultAddress = async (userId, addressId) => {
    const existing = await findAddressById(addressId, userId);
    if (!existing) {
        throw new Error("Address not found or unauthorized access.");
    }
    await unsetDefaultAddresses(userId);
    return await updateAddress(addressId, userId, { isDefault: true });
};