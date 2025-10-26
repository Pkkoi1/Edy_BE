const {
  deleteFile,
  getFileInfo,
  extractPublicIdFromUrl,
  extractResourceTypeFromUrl,
} = require("../services/cloudinary.service");

exports.deleteFile = async (req, res) => {
  try {
    const { publicId, resourceType } = req.body;

    if (!publicId) {
      return res.status(400).json({
        message: "Public ID là bắt buộc",
      });
    }

    const result = await deleteFile(publicId, resourceType || "raw");

    res.json({
      message: "Xóa file thành công",
      data: result,
    });
  } catch (error) {
    console.error("Error in deleteFile controller:", error);

    if (
      error.http_code === 404 ||
      (error.message && error.message.includes("not found"))
    ) {
      return res
        .status(404)
        .json({ message: "File không tồn tại trên Cloudinary" });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi xóa file",
    });
  }
};

exports.getFileInfo = async (req, res) => {
  try {
    const { publicId, resourceType } = req.body;

    if (!publicId) {
      return res.status(400).json({
        message: "Public ID là bắt buộc",
      });
    }

    const result = await getFileInfo(publicId, resourceType || "raw");

    res.json({
      message: "Lấy thông tin file thành công",
      data: result,
    });
  } catch (error) {
    console.error("Error in getFileInfo controller:", error);

    // Kiểm tra lỗi 404 từ Cloudinary
    if (
      error.http_code === 404 ||
      (error.message && error.message.includes("not found"))
    ) {
      return res
        .status(404)
        .json({ message: "File không tồn tại trên Cloudinary" });
    }

    res.status(500).json({
      message: "Đã xảy ra lỗi khi lấy thông tin file",
    });
  }
};
