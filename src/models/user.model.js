const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  avatar: String,
//   organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  follower: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  field_of_study: [String],
  point: { type: Number, default: 0 },
  rank_point: { type: Number, default: 0 },
  strike: { type: Number, default: 0 },
  free_download_count: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  search_history: [String],
//   read_history: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
//   shared_documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
//   favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active'
  }
});

module.exports = mongoose.model('User', userSchema);