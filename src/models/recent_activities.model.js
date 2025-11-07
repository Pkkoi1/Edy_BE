const mongoose = require("mongoose");

const recentActivitySchema = new mongoose.Schema(
  {
    // Loại hoạt động
    type: {
      type: String,
      enum: [
        "DOCUMENT_APPROVED", // Tài liệu được duyệt
        "DOCUMENT_EDIT_REQUESTED", // Yêu cầu chỉnh sửa tài liệu
        "DOCUMENT_DELETED", // Tài liệu bị xóa
        "DOCUMENT_UPLOADED", // Tài liệu mới được tải lên
        "USER_CREATED", // Người dùng mới
        "ORGANIZATION_CREATED", // Trường mới được tạo
        "SUBJECT_CREATED", // Môn học mới được thêm
        "USER_BANNED", // Người dùng bị cấm
        "USER_UNBANNED", // Người dùng được bỏ cấm
        "REPORT_RESOLVED", // Báo cáo được xử lý
      ],
      required: true,
    },

    // Mô tả hoạt động (để hiển thị)
    description: {
      type: String,
      required: true,
    },

    // Người thực hiện hoạt động
    actor: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      role: {
        type: String,
        default: "USER",
      },
    },

    // Đối tượng bị ảnh hưởng
    target: {
      type: {
        type: String,
        enum: ["DOCUMENT", "USER", "ORGANIZATION", "SUBJECT", "REPORT"],
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
      },
      name: {
        type: String,
      },
    },

    // Thông tin bổ sung
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Màu sắc cho UI (success, warning, danger, info)
    color: {
      type: String,
      enum: ["success", "warning", "danger", "info"],
      default: "info",
    },

    // Icon cho UI
    icon: {
      type: String,
      default: "activity",
    },
  },
  {
    timestamps: true,
  }
);

// Index để query nhanh
recentActivitySchema.index({ createdAt: -1 });
recentActivitySchema.index({ type: 1, createdAt: -1 });

// Static method để tạo hoạt động mới
recentActivitySchema.statics.createActivity = async function (activityData) {
  const activity = new this(activityData);
  await activity.save();
  return activity;
};

// Static method để lấy hoạt động gần đây
recentActivitySchema.statics.getRecentActivities = async function (limit = 10) {
  return this.find()
    .populate("actor.user", "first_name last_name avatar")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Method để format cho frontend
recentActivitySchema.methods.toDisplayFormat = function () {
  return {
    id: this._id,
    type: this.type,
    description: this.description,
    actor: {
      name: this.actor.name,
      role: this.actor.role,
      avatar: this.actor.user?.avatar,
    },
    target: this.target,
    color: this.color,
    icon: this.icon,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("RecentActivity", recentActivitySchema);
