const mongoose = require('mongoose');

const { Schema } = mongoose;

const textVersionSchema = new Schema(
  {
    version: { type: Number, required: true },
    text: { type: String, required: true },
    autor_id: { type: String, required: true },
    datum: { type: Date, default: Date.now },
  },
  { _id: false }
);

const anhangSchema = new Schema(
  {
    typ: { type: String, enum: ['bild', 'link', 'studie', 'quelle'], required: true },
    url: { type: String, required: true },
    titel: String,
    hinzugefuegt_von: { type: String, required: true },
    datum: { type: Date, default: Date.now },
  },
  { _id: false }
);

const nodeSchema = new Schema({
  typ: { type: String, enum: ['thema', 'argument'], required: true },
  texte: {
    neutral: { type: [textVersionSchema], default: [] },
    pro: { type: [textVersionSchema], default: [] },
    contra: { type: [textVersionSchema], default: [] },
  },
  tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
  anhaenge: { type: [anhangSchema], default: [] },
  ersteller_id: { type: String, required: true },
  erstellt_am: { type: Date, default: Date.now },
  likes_count: { type: Number, default: 0 },
  comments_count: { type: Number, default: 0 },
  bearbeitet_von: { type: [String], default: [] },
  soft_deleted: { type: Boolean, default: false },
  soft_deleted_grund: String,
  soft_deleted_von: String,
  sichtbarkeit: { type: String, enum: ['oeffentlich', 'privat'], default: 'oeffentlich' },
});

nodeSchema.index({ typ: 1, soft_deleted: 1, sichtbarkeit: 1 });
// Covers the sort modes used by GET /themen and GET /nodes/:id/kinder (see utils/sorting.js)
// so those queries don't fall back to an in-memory sort as discussions grow.
nodeSchema.index({ typ: 1, soft_deleted: 1, sichtbarkeit: 1, erstellt_am: -1 });
nodeSchema.index({ typ: 1, soft_deleted: 1, sichtbarkeit: 1, likes_count: -1 });
nodeSchema.index({ soft_deleted: 1, erstellt_am: -1 });
nodeSchema.index({ soft_deleted: 1, likes_count: -1 });
nodeSchema.index({ tags: 1 });
nodeSchema.index(
  {
    'texte.neutral.text': 'text',
    'texte.pro.text': 'text',
    'texte.contra.text': 'text',
  },
  { name: 'node_fulltext' }
);

module.exports = mongoose.model('Node', nodeSchema);
