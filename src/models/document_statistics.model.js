const mongoose = require("mongoose");

const documentStatisticsSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    day: { type: Number, min: 1, max: 31 }, // Optional for daily stats

    // Thống kê tổng quan
    totalDocuments: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    totalDownloads: { type: Number, default: 0 },

    // Thống kê theo loại tài liệu
    documentTypes: {
      type: Map,
      of: Number,
      default: {},
    },

    // Top 5 tài liệu được xem và tải nhiều nhất
    topDocuments: [
      {
        document: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
        title: { type: String },
        views: { type: Number, default: 0 },
        downloads: { type: Number, default: 0 },
        rating: { type: Number, default: 0 }, // Percentage
      },
    ],

    // Tài liệu đã duyệt
    approvedDocuments: [
      {
        document: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
        title: { type: String },
        author: { type: String },
        subject: { type: String },
        uploadDate: { type: Date },
        approvedDate: { type: Date },
        approvedBy: { type: String }, // 'AI' or 'Admin'
        status: { type: String, default: "Đã duyệt" },
      },
    ],

    // Dữ liệu hàng ngày (nếu day được set)
    dailyViews: { type: Number, default: 0 },
    dailyDownloads: { type: Number, default: 0 },

    // Timestamp cập nhật cuối cùng
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Compound index để đảm bảo mỗi tháng chỉ có 1 thống kê
documentStatisticsSchema.index({ year: 1, month: 1 }, { unique: true });

// Index cho daily stats
documentStatisticsSchema.index({ year: 1, month: 1, day: 1 }, { sparse: true });

module.exports = mongoose.model("DocumentStatistics", documentStatisticsSchema);
