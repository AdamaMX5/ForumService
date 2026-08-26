// Cursor-based pagination (no offset/skip — see spec section 8: MongoDB skip performance
// degrades badly on long discussion threads). Cursor encodes { sortVal, id } as base64 JSON.

function encodeCursor(sortVal, id) {
  const payload = JSON.stringify({ sortVal, id: String(id) });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// Cursor values are attacker-controlled (client round-trips them verbatim) and get placed
// directly into a Mongo query filter in sorting.js. Reject anything that isn't a plain
// string/number/id - in particular objects like {"$gt": ""} - so a crafted cursor can never
// smuggle a Mongo query operator into the filter (NoSQL operator injection).
function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const { sortVal, id } = payload || {};
    const sortValOk =
      (typeof sortVal === 'string' && sortVal.length > 0 && sortVal.length < 200) ||
      (typeof sortVal === 'number' && Number.isFinite(sortVal));
    const idOk = typeof id === 'string' && OBJECT_ID_RE.test(id);
    if (!sortValOk || !idOk) return null;
    return { sortVal, id };
  } catch (err) {
    return null;
  }
}

module.exports = { encodeCursor, decodeCursor };
