const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null  },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
}, {
  timestamps: true
});

module.exports = mongoose.model('Assignment', assignmentSchema);