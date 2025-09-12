const mongoose = require('mongoose');

const privateShareSchema = new mongoose.Schema({
  access_url: { type: String, required: true },
  limited_access: { type: Number, default: null },
  request: { type: Boolean, default: false },
  time_limited: { type: Boolean, default: false },
  start_date: { type: Date },
  end_date: { type: Date },
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Blocked'],
    default: 'Active'
  },
  user_accessed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
  timestamps: true
});

module.exports = mongoose.model('PrivateShare', privateShareSchema);