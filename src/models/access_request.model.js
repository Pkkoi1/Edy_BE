const mongoose = require('mongoose');

const accessRequestSchema = new mongoose.Schema({
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  private_share: { type: mongoose.Schema.Types.ObjectId, ref: 'PrivateShare', required: true },
  expiredAt: { type: Date, default: null },
  content: { type: String, default: null },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'DENIED'],
    default: 'PENDING'
  }
}, {
  timestamps: true
});

accessRequestSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AccessRequest', accessRequestSchema);