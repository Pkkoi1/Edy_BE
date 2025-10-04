const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  cmt: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: [{
    type: String,
    enum: ['SPAM_OR_MISLEADING', 'DUPLICATE', 'COPYRIGHT', 'INCORRECT_CATEGORY', 'PERSONAL_INFORMATION', 'LOW_QUALITY', 'INAPPROPRIATE', 'OTHER']
  }],
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ['PROCESSING', 'RESOLVED'],
    default: 'PROCESSING'
  },
  resolvedAt: { type: Date, default: null },
  resolveBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: {
    type: String,
    enum: ['EDIT_REQUESTED', 'DELETE', 'FALSE_REPORT'],
    default: null,
  },
  resolveReason: { type: String, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);