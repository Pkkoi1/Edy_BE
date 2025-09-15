const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  description: { type: String, default: '' },
  is_checked: { type: Boolean, default: false },
  checked_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  checked_at: { type: Date, default: null },
  is_deleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Subject', subjectSchema);