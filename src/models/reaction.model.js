const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['LIKE', 'DISLIKE'],
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reaction', reactionSchema);