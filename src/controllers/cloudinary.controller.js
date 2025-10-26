const {
  deleteFile,
  getFileInfo,
  extractPublicIdFromUrl,
  extractResourceTypeFromUrl,
} = require("../services/cloudinary.service");

exports.deleteFile = async (req, res) => {
  try {
    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        message: "URL file là bắt buộc",
      });
    }

    // Trích xuất publicId và resourceType từ URL
    const targetPublicId = extractPublicIdFromUrl(fileUrl);
    const resourceType = extractResourceTypeFromUrl(fileUrl);

    if (!targetPublicId) {
      return res.status(400).json({
        message: "Không thể trích xuất public ID từ URL file",
      });
    }

    const result = await deleteFile(targetPublicId, resourceType);

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
    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        message: "URL file là bắt buộc",
      });
    }

    // Trích xuất publicId và resourceType từ URL
    const targetPublicId = extractPublicIdFromUrl(fileUrl);
    const resourceType = extractResourceTypeFromUrl(fileUrl);
    console.log(
      "Extracted publicId:",
      targetPublicId,
      "resourceType:",
      resourceType,
      "from URL:",
      fileUrl
    );

    if (!targetPublicId) {
      return res.status(400).json({
        message: "Không thể trích xuất public ID từ URL file",
      });
    }

    const result = await getFileInfo(targetPublicId, resourceType);

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
