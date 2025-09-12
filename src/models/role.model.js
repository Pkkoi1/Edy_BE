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
      'MANAGE_DOCUMENT',
      'HANDLE_REPORT',
      'MANAGE_USER',
      'MANAGE_COMMENT',
      'MANAGE_SERVER',
      'MANAGE_ENTITY', // quản lý thực thể trong hệ thống, ví dụ như subject, organization
      'MANAGE_ROLE',
      'ALL'
    ]
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Role', roleSchema);