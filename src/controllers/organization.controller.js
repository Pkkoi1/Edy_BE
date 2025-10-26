const {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
} = require("../services/organization.service");

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
    const organizations = await getOrganizations({ is_dropdown, search });
    res.json({ organizations });
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
