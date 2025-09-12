const mongoose = require('mongoose');

const downloadLinkSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'EXPIRED'],
    default: 'PENDING'
  },
  type: {
    type: String,
    enum: ['FREE', 'POINT'],
    required: true
  },
  cost: { type: Number, default: 0 },
  expiredAt: { type: Date, default: null },
  accessedAt: { type: Date, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('DownloadLink', downloadLinkSchema);