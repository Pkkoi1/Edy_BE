const mongoose = require('mongoose');

const pointTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['EARN', 'SPEND'],
    required: true
  },
  point: { type: Number, required: true },
  reason: { type: String, required: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model('PointTransaction', pointTransactionSchema);