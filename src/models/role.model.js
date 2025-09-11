const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  code: {
    type: String,
    enum: [
      'SUPER_ADMIN',
      'CONTENT_REVIEWER',
      'ORG_ADMIN',
      'MODERATOR',
      'SYSTEM_ADMIN'
    ],
    required: true,
    unique: true
  },
  name: { type: String, required: true },
  description: String,
  permissions: [{
    type: String,
    enum: [
      'APPROVE_DOC',
      'APPROVE_SUMMARY',
      'REJECT_DOC',
      'HANDLE_REPORT',
      'BAN_USER',
      'DELETE_COMMENT',
      'MANAGE_SERVER',
      'MANAGE_ACCOUNT',
      'ALL'
    ]
  }]
});

module.exports = mongoose.model('Role', roleSchema);