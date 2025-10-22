const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["REGISTER", "RESET_PASSWORD", "VERIFY_EMAIL"],
      default: "REGISTER",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 phút
      index: { expires: 0 }, // Tự động xóa sau khi hết hạn
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tối ưu query
otpSchema.index({ email: 1, type: 1, isUsed: 1 });

module.exports = mongoose.model("OTP", otpSchema);
