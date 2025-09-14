const Organization = require("../models/organization.model");

const createOrganization = async (data) => {
    const code = data.code.trim().toUpperCase();
    const existing = await Organization.findOne({ code, is_deleted: false });
    if (existing) {
        throw new Error("Mã tổ chức đã tồn tại");
    }
    const org = new Organization(data);
    await org.save();
    return org;
};

const deleteOrganization = async (id) => {
    return Organization.findByIdAndUpdate(id, { is_deleted: true }, { new: true });
};

const updateOrganization = async (id, data) => {
    if ('is_deleted' in data) delete data.is_deleted;
    return Organization.findByIdAndUpdate(id, data, { new: true });
};

const getOrganizationById = async (id) => {
    return Organization.findOne({ _id: id, is_deleted: false });
};

// Lấy danh sách tổ chức, nếu is_dropdown=true thì chỉ lấy id, name, code
const getOrganizations = async ({ is_dropdown = false, search } = {}) => {
    const query = { is_deleted: false };
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } }
        ];
    }
    if (is_dropdown) {
        return Organization.find(query).select('_id name code');
    }
    return Organization.find(query);
};

module.exports = {
    createOrganization,
    deleteOrganization,
    updateOrganization,
    getOrganizationById,
    getOrganizations
};