const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  description: { type: String },
  is_deleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Subject', subjectSchema);