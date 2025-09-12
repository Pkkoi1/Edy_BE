const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String },
  subjects: [{
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    count: { type: Number, default: 0 }
  }],
  country: { type: String },
  address: { type: String },
  website: { type: String },
  content_categories: [
    {
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
          'Lecture'
        ]
      },
      document_count: { type: Number, default: 0 }
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model('Organization', organizationSchema);