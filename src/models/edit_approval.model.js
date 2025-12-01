const mongoose = require('mongoose');

const editApprovalSchema = new mongoose.Schema({    
    doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    edit_doc: { type: mongoose.Schema.Types.ObjectId, ref: 'EditDocument', required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewed_at: { type: Date, default: null },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    },
    message: { type: String, default: '' },
    ai_checked: { type: Boolean, default: false },
    ai_violation_level: { type: String, enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'], default: 'NONE' },
    ai_action_suggest: { type: String, enum: ['AUTO_APPROVE', 'MANUAL_REVIEW', 'REJECT'], default: 'MANUAL_REVIEW' },
    ai_reason: { type: String, default: '' },
    expiredAt: { type: Date, default: null }
}, {
    timestamps: true
});

editApprovalSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('EditApproval', editApprovalSchema);
