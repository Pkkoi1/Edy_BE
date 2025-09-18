const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String },
  subjects: [{
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    count: { type: Number, default: 0 }
  }],
  country: { type: String, required: true },
  address: { type: String, required: true },
  website: { type: String, required: true },
  logo: { type: String, default: null },
  content_categories: [
    {
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
        ]
      },
      document_count: { type: Number, default: 0 }
    }
  ],
  is_checked: { type: Boolean, default: false },
  checked_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  checked_at: { type: Date, default: null },
  is_deleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Organization', organizationSchema);