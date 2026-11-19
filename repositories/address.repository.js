import Address from "../models/address.model.js";

export const findAddressesByUser = async (userId) => {
    return await Address.find({ userId })
        .sort({ isDefault: -1, createdAt: -1 });
};

export const findAddressById = async (addressId, userId) => {
    return await Address.findOne({
        _id: addressId,
        userId
    });
};

export const createAddress = async (data) => {
    return await Address.create(data);
};

export const updateAddress = async (addressId, userId, data) => {
    return await Address.findOneAndUpdate(
        {
            _id: addressId,
            userId
        },
        data,
        {
            new: true,
            runValidators: true
        }
    );
};

export const deleteAddress = async (addressId, userId) => {
    return await Address.findOneAndDelete({
        _id: addressId,
        userId
    });
};

export const unsetDefaultAddresses = async (userId) => {
    return await Address.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } }
    );
};
