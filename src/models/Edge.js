const mongoose = require('mongoose');

const { Schema } = mongoose;

const edgeSchema = new Schema({
  von: { type: Schema.Types.ObjectId, ref: 'Node', required: true }, // Kind-Node
  zu: { type: Schema.Types.ObjectId, ref: 'Node', required: true }, // Eltern-Node
  typ: {
    type: String,
    enum: ['pro', 'contra', 'differenzierung', 'referenz'],
    required: true,
  },
  autor_id: { type: String, required: true },
  erstellt_am: { type: Date, default: Date.now },
});

edgeSchema.index({ zu: 1, typ: 1 });
edgeSchema.index({ von: 1 });

module.exports = mongoose.model('Edge', edgeSchema);
