const mongoose = require('mongoose');

const approvalRequestSchema = new mongoose.Schema({
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approved_at: { type: Date, default: null },
  is_summary: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  message: { type: String, default: '' }
}, {
  timestamps: true
});

module.exports = mongoose.model('ApprovalRequest', approvalRequestSchema);