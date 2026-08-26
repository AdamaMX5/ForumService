const { decodeCursor, encodeCursor } = require('./pagination');

// Drei Sortiermodi aus Spec Abschnitt 5. "beste" ist der einfache Startpunkt
// (likes_count primaer, erstellt_am als Tie-Breaker) - Wilson-Score ist als spaeterer
// Ausbau vorgesehen (Abschnitt 15), bewusst nicht Teil des ersten Wurfs.
const SORT_MODES = {
  neu: { field: 'erstellt_am', order: -1 },
  likes: { field: 'likes_count', order: -1 },
  // Tie-breaks on _id only (not erstellt_am) - full erstellt_am tie-breaking plus
  // Wilson-Score is deferred (spec section 15), this is the "einfacher Startpunkt".
  beste: { field: 'likes_count', order: -1 },
  // Klassischer Kommentarbereich liest chronologisch aufsteigend (aeltester zuerst).
  chronologisch: { field: 'erstellt_am', order: 1 },
};

function resolveSortMode(sort) {
  return SORT_MODES[sort] || SORT_MODES.beste;
}

/**
 * Builds a Mongo filter + sort spec implementing keyset pagination for the given mode.
 * Tie-breaks on _id to keep the cursor stable when sort field values collide.
 */
function buildPaginationQuery({ baseFilter, sort, cursor, limit }) {
  const mode = resolveSortMode(sort);
  const sortSpec = { [mode.field]: mode.order, _id: mode.order };

  const filter = { ...baseFilter };
  const decoded = decodeCursor(cursor);
  if (decoded) {
    const cmpOp = mode.order === -1 ? '$lt' : '$gt';
    filter.$or = [
      { [mode.field]: { [cmpOp]: decoded.sortVal } },
      { [mode.field]: decoded.sortVal, _id: { [cmpOp]: decoded.id } },
    ];
  }

  return { filter, sortSpec, sortField: mode.field, pageSize: limit };
}

function buildNextCursor(items, sortField) {
  if (items.length === 0) return null;
  const last = items[items.length - 1];
  return encodeCursor(last[sortField], last._id);
}

module.exports = { buildPaginationQuery, buildNextCursor, resolveSortMode };
