const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  code: {
    type: String,
    enum: [
      'SUPER_ADMIN',
      'DOCUMENT_ADMIN',
      'USER_ADMIN',
      'SYSTEM_ADMIN',
      'ENTITY_ADMIN',
      'CUSTOM_ROLE'
    ],
    required: true,
  },
  name: { type: String, required: true },
  description: String,
  permissions: [{
    type: String,
    enum: [
      'MANAGE_DOCUMENT',
      'HANDLE_DOCUMENT_REPORT',
      'MANAGE_USER',
      'MANAGE_COMMENT',
      'HANDLE_COMMENT_REPORT',
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