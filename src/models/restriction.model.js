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
restrictionSchema.index({ endAt: 1 }); 

module.exports = mongoose.model('Restriction', restrictionSchema);