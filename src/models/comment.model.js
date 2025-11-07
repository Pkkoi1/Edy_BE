const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  is_deleted: { type: Boolean, default: false },
  expiredAt: { type: Date, default: null }
}, {
  timestamps: true
});

// Tạo index để xóa tự động sau 1 ngày
commentSchema.index({ expiredAt: 1 }, {expireAfterSeconds: 0});
module.exports = mongoose.model('Comment', commentSchema);