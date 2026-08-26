const Like = require('../models/Like');

// Shared by every list endpoint (kinder/themen/suche) that wants to annotate each item with
// `liked_by_me` without an N+1 query per item: one batched Like lookup per response page.
async function getLikedIdSet(userId, nodeIds) {
  if (!userId || nodeIds.length === 0) return null;
  const likedDocs = await Like.find({ node_id: { $in: nodeIds }, user_id: userId })
    .select('node_id')
    .lean();
  return new Set(likedDocs.map((l) => String(l.node_id)));
}

// Reads a previously built Set (or null, meaning "not computed" - anonymous caller) back into
// the `likedByMe` shape serializeNode expects: undefined stays undefined (-> null on the wire).
function likedByMeFor(likedIds, nodeId) {
  return likedIds ? likedIds.has(String(nodeId)) : undefined;
}

module.exports = { getLikedIdSet, likedByMeFor };
