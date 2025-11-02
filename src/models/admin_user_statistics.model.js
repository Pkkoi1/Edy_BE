const mongoose = require("mongoose");

const adminUserStatisticsSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true }, // Năm thống kê
    month: { type: Number, required: true, min: 1, max: 12 }, // Tháng thống kê
    totalUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    inactiveUsers: { type: Number, default: 0 },
    bannedUsers: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 }, // Người dùng mới trong tháng
  },
  {
    timestamps: true,
  }
);

// Index cho year và month để query nhanh
adminUserStatisticsSchema.index({ year: 1, month: 1 }, { unique: true });

// Middleware để drop index cũ nếu có
adminUserStatisticsSchema.pre("save", async function (next) {
  try {
    const collection = this.constructor.collection;
    const indexes = await collection.indexes();

    // Drop các index cũ
    const oldIndexes = ["date_1", "year_1", "date_1_unique"];
    for (const indexName of oldIndexes) {
      const index = indexes.find((idx) => idx.name === indexName);
      if (index) {
        await collection.dropIndex(indexName);
        console.log(`Dropped old ${indexName} index`);
      }
    }
  } catch (error) {
    // Ignore errors if index doesn't exist
  }
  next();
});

module.exports = mongoose.model(
  "AdminUserStatistics",
  adminUserStatisticsSchema
);
