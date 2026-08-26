const mongoose = require('mongoose');

const { Schema } = mongoose;

const likeSchema = new Schema({
  node_id: { type: Schema.Types.ObjectId, ref: 'Node', required: true },
  user_id: { type: String, required: true },
  datum: { type: Date, default: Date.now },
});

// Prevents duplicate likes from the same user on the same node.
likeSchema.index({ node_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
