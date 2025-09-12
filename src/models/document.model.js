const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: {
    summary_by_user: { type: String },
    summary_by_ai: { type: String }
  },
  author: [{ type: String }],
  url: { type: String, required: true },
  published_year: { type: Number, default: null },
  publisher: { type: String, default: null },
  intensive: { type: Boolean, default: false },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  level: { type: String,
    enum: [
        'Student',
        'University',
        'Lecturer',
        'Researcher',
        'Other'
    ]
   }, 
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  status: {
    type: String,
    enum: [
      'pending',
      'approved',
      'pending_summary',
      'rejected',
      'requested_edit'
    ],
    default: 'pending'
  },
  public_mode: {
    type: String,
    enum: [
      'public',
      'private',
      'private_shared',
      'share_organization'
    ],
    default: 'public'
  },
  page: { type: Number },
  file_type: {
    type: String,
    enum: ['Word', 'PDF', 'Excel', 'Video', 'Powerpoint'],
    required: true
  },
  keyword: [{ type: String }],
  title: { type: String, required: true },
  doc_type: {
    type: String,
    enum: [
      'Research Report',
      'Video',
      'Study Guide',
      'Textbook',
      'Essay',
      'Solution Set',
      'Thesis',
      'Lecture',
      'Other'
    ],
    required: true
  },
  view: { type: Number, default: 0 },
  comment_count: { type: Number, default: 0 },
  download_count: { type: Number, default: 0 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Document', documentSchema);