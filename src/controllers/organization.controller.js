const {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
} = require("../services/organization.service");
const { logOrganizationCreated } = require("../services/activity_log.service");

exports.createOrganization = async (req, res) => {
  try {
    const { name, code, country, address, website, description } = req.body;

    const org = await createOrganization({
      name,
      code,
      country,
      address,
      website,
      description,
      created_by: req.user.userId,
    });

    // Log activity for organization creation
    await logOrganizationCreated(org._id, req.user.userId);

    res.status(201).json({ message: "Tạo mới thành công", organization: org });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi tạo mới" });
  }
};

exports.getOrganizations = async (req, res) => {
  try {
    const is_dropdown = req.query.is_dropdown === "true";
    const search = req.query.search || "";
    const page = req.query.page !== undefined ? req.query.page : undefined;
    const limit = req.query.limit !== undefined ? req.query.limit : undefined;
    const country = req.query.country || undefined;
    const code = req.query.code || undefined;
    const sortBy = req.query.sortBy || undefined;
    const sortOrder = req.query.sortOrder || undefined;

    // Validate pagination params if provided
    if (page !== undefined) {
      const p = parseInt(page, 10);
      if (isNaN(p) || p < 1) {
        return res.status(400).json({ message: "page phải là số nguyên >= 1" });
      }
    }

    if (limit !== undefined) {
      const l = parseInt(limit, 10);
      if (isNaN(l) || l < 1 || l > 1000) {
        return res
          .status(400)
          .json({ message: "limit phải là số nguyên trong khoảng 1-1000" });
      }
    }

    const options = {
      is_dropdown,
      search,
      page,
      limit,
      country,
      code,
      sortBy,
      sortOrder,
    };

    const result = await getOrganizations(options);

    // If dropdown or non-paginated array was returned
    if (is_dropdown || !options.page) {
      return res.json({ success: true, data: result });
    }

    // Paginated response
    return res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi lấy danh sách" });
  }
};

exports.getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await getOrganizationById(id);

    if (!organization) {
      return res.status(404).json({ message: "Tổ chức không tồn tại" });
    }

    res.json({ organization });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi lấy thông tin tổ chức" });
  }
};

exports.updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, country, address, website, description } = req.body;

    const organization = await updateOrganization(id, {
      name,
      code,
      country,
      address,
      website,
      description,
    });

    if (!organization) {
      return res.status(404).json({ message: "Tổ chức không tồn tại" });
    }

    res.json({
      message: "Cập nhật tổ chức thành công",
      organization,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi cập nhật tổ chức" });
  }
};

exports.deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = await deleteOrganization(id);

    if (!organization) {
      return res.status(404).json({ message: "Tổ chức không tồn tại" });
    }

    res.json({ message: "Xóa tổ chức thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi xóa tổ chức" });
  }
};
