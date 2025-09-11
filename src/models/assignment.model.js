const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  role_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  subject: { type: String, default: null },
//   organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Assignment', assignmentSchema);