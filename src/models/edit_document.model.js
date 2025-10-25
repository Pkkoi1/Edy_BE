const mongoose = require('mongoose');

const editDocumentSchema = new mongoose.Schema({
    original_document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    summary_by_user: { type: String, default: null },
    author: [{ type: String }],
    url: { type: String, required: true },
    cover_page: { type: String, default: null },
    published_year: { type: Number, default: null },
    publisher: { type: String, default: null },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    level: {
        type: String,
        enum: [
            'STUDENT',
            'UNIVERSITY',
            'LECTURER',
            'RESEARCHER',
            'OTHER'
        ],
        required: true
    },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    status: {
        type: String,
        enum: [
            'PENDING',
            'APPROVED',
            'REJECTED',
        ],
        default: 'PENDING'
    },
    public_mode: {
        type: String,
        enum: [
            'PUBLIC',
            'PRIVATE',
            'PRIVATE_SHARED',
            'SHARE_ORGANIZATION'
        ],
        default: 'PUBLIC'
    },
    page: { type: Number },
    file_type: {
        type: String,
        enum: ['WORD', 'PDF', 'EXCEL', 'VIDEO', 'POWERPOINT'],
        required: true
    },
    keyword: [{ type: String }],
    title: { type: String, required: true },
    doc_type: {
        type: String,
        enum: [
            'RESEARCH_REPORT',
            'VIDEO',
            'STUDY_GUIDE',
            'TEXTBOOK',
            'ESSAY',
            'SOLUTION_SET',
            'THESIS',
            'LECTURE',
            'OTHER'
        ],
        required: true
    },
    expiredAt: { type: Date, default: null },
    is_deleted: { type: Boolean, default: false }
}, {
    timestamps: true
});

module.exports = mongoose.model('EditDocument', editDocumentSchema);