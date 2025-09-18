const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
    enum: ['DELETE', 'FALSE_REPORT']
  },
  resolveReason: { type: String, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);