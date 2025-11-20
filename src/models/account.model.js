const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    is_verified: { type: Boolean, default: false },
    is_vip: { type: Boolean, default: false },
    has_been_vip: { type: Boolean, default: false }, // Track if user has ever been VIP
    is_admin: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Account", accountSchema);
