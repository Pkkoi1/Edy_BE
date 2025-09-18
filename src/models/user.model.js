const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  contact_email: { type: String, required: true, unique: true },
  avatar: { type: String, default: null },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  last_organization_change: { type: Date, default: null },
  follower: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  field_of_study: [String],
  point: { type: Number, default: 0 },
  rank_point: { type: Number, default: 0 },
  strike: { type: Number, default: 0 },
  free_download_count: { type: Number, default: 3 },
  search_history: [{
    keyword: String,
    searched_at: { type: Date, default: Date.now }
  }],
  read_history: [{
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    read_at: { type: Date, default: Date.now }
  }],
  shared_documents: [{
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    shared_at: { type: Date, default: Date.now }
  }],
  favorites: [{
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    added_at: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'BANNED'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);