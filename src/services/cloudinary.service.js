const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const deleteFile = async (publicId, resourceType = "raw") => {
  try {
    if (!publicId) {
      throw new Error("Public ID là bắt buộc");
    }

    console.log(
      "Deleting file with publicId:",
      publicId,
      "resourceType:",
      resourceType
    );

    // Thử xóa với resource type được chỉ định
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    if (result.result === "ok") {
      console.log("Deleted file with resourceType:", resourceType);
      return {
        success: true,
        public_id: publicId,
        message: "File đã được xóa thành công",
      };
    } else if (result.result === "not found") {
      throw new Error("File không tồn tại trên Cloudinary");
    } else {
      throw new Error("Lỗi khi xóa file: " + result.result);
    }
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw error;
  }
};

const getFileInfo = async (publicId, resourceType = "raw") => {
  try {
    if (!publicId) {
      throw new Error("Public ID là bắt buộc");
    }

    console.log(
      "Searching for publicId:",
      publicId,
      "with initial resourceType:",
      resourceType
    );

    // Thử với resource type từ URL trước
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });
      console.log("Found file with resourceType:", resourceType);
      return result;
    } catch (primaryError) {
      console.log(
        "Not found with resourceType:",
        resourceType,
        "trying others..."
      );
    }

    // Nếu không tìm thấy, thử các resource type khác
    const resourceTypes = ["raw", "image", "video"];
    for (const type of resourceTypes) {
      if (type === resourceType) continue; // Đã thử rồi

      try {
        const result = await cloudinary.api.resource(publicId, {
          resource_type: type,
        });
        console.log("Found file with resourceType:", type);
        return result;
      } catch (error) {
        console.log("Not found with resourceType:", type);
      }
    }

    // Nếu không tìm thấy ở đâu, throw error
    throw new Error("File không tồn tại trên Cloudinary");
  } catch (error) {
    console.error("Error in getFileInfo:", error);
    throw error;
  }
};

const extractResourceTypeFromUrl = (url) => {
  try {
    // Tìm resource type từ URL pattern: /resource_type/
    const match = url.match(/\/(raw|image|video)\//);
    return match ? match[1] : "image"; // Mặc định là image nếu không tìm thấy
  } catch (error) {
    console.error("Error extracting resource type:", error);
    return "image";
  }
};

const extractPublicIdFromUrl = (url) => {
  try {
    if (!url) return null;

    // Tìm vị trí resource type trong URL
    const resourceMatch = url.match(/\/(raw|image|video)\//);
    if (!resourceMatch) return null;

    const resourceType = resourceMatch[1];
    const afterResource = url.substring(
      resourceMatch.index + resourceMatch[0].length
    );

    // Loại bỏ version number: v1234567890/
    const withoutVersion = afterResource.replace(/^v\d+\//, "");

    // Loại bỏ extension từ dấu chấm cuối
    const lastDotIndex = withoutVersion.lastIndexOf(".");
    if (lastDotIndex === -1) return null;

    return withoutVersion.substring(0, lastDotIndex);
  } catch (error) {
    console.error("Error extracting publicId:", error);
    return null;
  }
};

module.exports = {
  deleteFile,
  getFileInfo,
  extractPublicIdFromUrl,
  extractResourceTypeFromUrl,
};
