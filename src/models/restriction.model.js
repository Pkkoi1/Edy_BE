// src/models/restriction.model.js
const mongoose = require('mongoose');

const restrictionSchema = new mongoose.Schema({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  restricted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['POST', 'COMMENT', 'DOWNLOAD', 'LOGIN'],
    required: true
  },
  reason: { type: String, default: null },
  startAt: { type: Date, required: true, default: Date.now },
  endAt: { type: Date, default: null }, // null = vĩnh viễn
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true
});

// Index để query nhanh
restrictionSchema.index({ account_id: 1, type: 1, status: 1 });
restrictionSchema.index({ endAt: 1 }); // Cho cleanup expired restrictions

// Pre-save middleware để check expiration
restrictionSchema.pre('save', function(next) {
  if (this.endAt && new Date() > this.endAt) {
    this.status = 'EXPIRED';
  }
  next();
});

// Static method để check restriction
restrictionSchema.statics.hasActiveRestriction = async function(accountId, restrictionType) {
  const restriction = await this.findOne({
    account_id: accountId,
    type: restrictionType,
    status: 'ACTIVE',
    $or: [
      { endAt: null }, // Vĩnh viễn
      { endAt: { $gt: new Date() } } // Chưa hết hạn
    ]
  });
  return !!restriction;
};

// Static method để get all active restrictions của user
restrictionSchema.statics.getUserRestrictions = async function(accountId) {
  return await this.find({
    account_id: accountId,
    status: 'ACTIVE',
    $or: [
      { endAt: null },
      { endAt: { $gt: new Date() } }
    ]
  }).populate('admin_id', 'username');
};

module.exports = mongoose.model('Restriction', restrictionSchema);