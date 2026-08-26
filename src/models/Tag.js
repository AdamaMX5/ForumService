const mongoose = require('mongoose');

const { Schema } = mongoose;

const tagSchema = new Schema({
  name: { type: String, required: true, unique: true },
  parent_tag_id: { type: Schema.Types.ObjectId, ref: 'Tag', default: null },
  beschreibung: String,
});

module.exports = mongoose.model('Tag', tagSchema);
