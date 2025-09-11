const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  is_vip: { type: Boolean, default: false },
  password: { type: String, required: true },
  is_admin: { type: Boolean, default: false }
});

module.exports = mongoose.model('Account', accountSchema);