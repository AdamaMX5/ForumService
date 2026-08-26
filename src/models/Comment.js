const mongoose = require('mongoose');

const { Schema } = mongoose;

const commentSchema = new Schema({
  node_id: { type: Schema.Types.ObjectId, ref: 'Node', required: true },
  parent_comment_id: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
  text: { type: String, required: true },
  autor_id: { type: String, required: true },
  erstellt_am: { type: Date, default: Date.now },
  soft_deleted: { type: Boolean, default: false },
});

commentSchema.index({ node_id: 1, erstellt_am: 1, _id: 1 });

module.exports = mongoose.model('Comment', commentSchema);
