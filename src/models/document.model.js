const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: {
    summary_by_user: { type: String, default: null},
    summary_by_ai: { type: String, default: null}
  },
  author: [{ type: String }],
  url: { type: String, required: true },
  cover_page: { type: String, default: null },
  published_year: { type: Number, default: null },
  publisher: { type: String, default: null },
  intensive: { type: Boolean, default: false },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  level: { type: String,
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
      'REQUESTED_EDIT',
      'PENDING_EDIT',
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
  view: { type: Number, default: 0 },
  comment_count: { type: Number, default: 0 },
  download_count: { type: Number, default: 0 },
  like: { type: Number, default: 0 },
  dislike: { type: Number, default: 0 },
  is_deleted: { type: Boolean, default: false },
  last_approved_at: { type: Date, default: null },
  is_delete_by_admin: { type: Boolean, default: false },
  delete_by_admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  delete_by_admin_reason: { type: String, default: null },
  delete_by_admin_at: { type: Date, default: null },
  expiredAt: { type: Date, default: null },
}, {
  timestamps: true
});

documentSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Document', documentSchema);