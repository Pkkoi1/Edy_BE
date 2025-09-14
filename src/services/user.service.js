const User = require('../models/user.model');
const Account = require('../models/account.model');
const Organization = require('../models/organization.model');
const mongoose = require('mongoose');

const getUsers = async () => {
    return await User.find();
}

const verifyUser = async (accountId, userId, field_of_study, organization) => {
    const account = await Account.findById(accountId);
    if (!account) throw new Error("Tài khoản không tồn tại");
    if (account.is_verified) return { error: "Tài khoản đã được xác minh" };

    let fieldOfStudyArray = [];
    if (Array.isArray(field_of_study)) {
        fieldOfStudyArray = field_of_study;
    } else {
        fieldOfStudyArray = field_of_study
            ? field_of_study.split(',').map(s => s.trim()).filter(s => s)
            : [];
    }

    if (!mongoose.Types.ObjectId.isValid(organization)) {
        return { error: "Không tìm thấy tổ chức" };
    }
    
    const existingOrganization = await Organization.findById(organization);
    if (!existingOrganization) {
        return { error: "Không tìm thấy tổ chức" };
    }

    const user = await User.findById(userId);
    user.field_of_study = fieldOfStudyArray;
    user.organization = organization;
    await user.save();

    account.is_verified = true;
    await account.save();

    return { success: true };
};

module.exports = { verifyUser };