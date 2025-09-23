const mongoose = require('mongoose');

const approveEditSchema = new mongoose.Schema({
    doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    edit_doc: { type: mongoose.Schema.Types.ObjectId, ref: 'EditDocument', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewed_at: { type: Date, default: null },
    is_summary: { type: Boolean, default: false },
    edit_type: {
        type: String,
        enum: ['DOCUMENT_EDIT', 'SUMMARY_EDIT', 'BOTH'],
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    },
    message: { type: String, default: '' },
    ai_checked: { type: Boolean, default: false },
    ai_violation_level: { type: String, enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'], default: 'NONE' },
    ai_action_suggest: { type: String, enum: ['AUTO_APPROVE', 'MANUAL_REVIEW', 'REJECT'], default: 'MANUAL_REVIEW' },
    ai_reason: { type: String, default: '' }
}, {
    timestamps: true
});

module.exports = mongoose.model('ApprovalRequest', approveEditSchema);