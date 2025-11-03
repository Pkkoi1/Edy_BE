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
  return Organization.findByIdAndUpdate(
    id,
    { is_deleted: true },
    { new: true }
  );
};

const updateOrganization = async (id, data) => {
  if ("is_deleted" in data) delete data.is_deleted;
  return Organization.findByIdAndUpdate(id, data, { new: true });
};

const getOrganizationById = async (id) => {
  return Organization.findOne({ _id: id, is_deleted: false });
};

// Lấy danh sách tổ chức, nếu is_dropdown=true thì chỉ lấy id, name, code
// Hỗ trợ: search, filters, pagination (page, limit), sort
// Nếu không truyền page/limit thì trả về tất cả phù hợp với query
const getOrganizations = async ({
  is_dropdown = false,
  search,
  country,
  code,
  page,
  limit,
  sortBy = "createdAt",
  sortOrder = "desc",
} = {}) => {
  const query = { is_deleted: false };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
    ];
  }

  if (country) {
    query.country = { $regex: `^${country}$`, $options: "i" };
  }

  if (code) {
    query.code = { $regex: code, $options: "i" };
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  // Dropdown minimal fields
  if (is_dropdown) {
    return Organization.find(query)
      .select("_id name code")
      .sort(sort)
      .populate({
        path: "created_by",
        select: "_id first_name last_name avatar",
      });
  }

  // If pagination provided, return paginated response
  if (page !== undefined && limit !== undefined) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [total, organizations] = await Promise.all([
      Organization.countDocuments(query),
      Organization.find(query)
        .populate([
          { path: "created_by", select: "_id first_name last_name avatar" },
          { path: "subjects.subject", select: "_id name" },
        ])
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      success: true,
      data: organizations,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
        limit: limitNum,
      },
    };
  }

  // Default: return all matching organizations with full details
  const organizations = await Organization.find(query)
    .populate([
      { path: "created_by", select: "_id first_name last_name avatar" },
      { path: "subjects.subject", select: "_id name" },
    ])
    .sort(sort);

  return organizations;
};

module.exports = {
  createOrganization,
  deleteOrganization,
  updateOrganization,
  getOrganizationById,
  getOrganizations,
};
