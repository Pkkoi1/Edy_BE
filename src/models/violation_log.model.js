const mongoose = require('mongoose');

const violationLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target: {
    type: {
      type: String,
      enum: ['DOCUMENT', 'COMMENT'],
      required: true
    },
    id: { type: mongoose.Schema.Types.ObjectId, required: true }
  },
  type: {
    type: String,
    enum: ['SPAM', 'COPYRIGHT', 'INAPPROPRIATE', 'OTHER'],
    required: true
  },
  strike: { type: Number, default: 1 },
  point_reduced: { type: Number, default: 0 },
  reason: { type: String, default: '' }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model('ViolationLog', violationLogSchema);