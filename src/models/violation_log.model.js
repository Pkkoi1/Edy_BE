const mongoose = require('mongoose');

const violationLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  cmt: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  type: [{
    type: String,
    enum: ['SPAM_OR_MISLEADING', 'DUPLICATE', 'COPYRIGHT', 'INCORRECT_CATEGORY', 'PERSONAL_INFORMATION', 'LOW_QUALITY', 'INAPPROPRIATE', 'OTHER'],
    required: true
  }],
  report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null }, // Có thể là admin tự xử lý ko qua report
  strike: { type: Number, default: 0 },
  point_reduced: { type: Number, default: 0 },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, default: '' },
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model('ViolationLog', violationLogSchema);