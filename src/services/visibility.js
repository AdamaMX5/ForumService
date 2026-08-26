const Node = require('../models/Node');
const Edge = require('../models/Edge');
const { isModOrAdmin } = require('../config/roles');

const MAX_ANCESTOR_DEPTH = 50;

/**
 * Walks the non-referenz parent chain (edge.von -> edge.zu) up to the root "thema".
 * Bounded by MAX_ANCESTOR_DEPTH and a visited-set to guard against malformed/cyclic data.
 */
async function findRootThemaId(nodeId) {
  let currentId = String(nodeId);
  const visited = new Set([currentId]);

  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth += 1) {
    const node = await Node.findById(currentId).select('typ').lean();
    if (!node) return null;
    if (node.typ === 'thema') return currentId;

    const parentEdge = await Edge.findOne({
      von: currentId,
      typ: { $in: ['pro', 'contra', 'differenzierung'] },
    })
      .select('zu')
      .lean();
    if (!parentEdge) return currentId; // orphaned argument, treat itself as root for visibility purposes

    const nextId = String(parentEdge.zu);
    if (visited.has(nextId)) return currentId; // cycle guard
    visited.add(nextId);
    currentId = nextId;
  }

  return currentId;
}

/**
 * Returns true if `user` is allowed to see a node belonging to the given thema's discussion.
 * Public themes: everyone. Private themes: only ADMIN/FORUM_MODERATOR (spec doesn't define
 * a per-theme membership list, so privileged roles are the only carve-out).
 */
function canViewThema(thema, user) {
  if (!thema || thema.sichtbarkeit !== 'privat') return true;
  return isModOrAdmin(user);
}

/**
 * Checks whether the given node (already fetched) is visible to `user`, resolving its
 * root thema's visibility if the node itself is an argument.
 */
async function isNodeVisible(node, user) {
  if (!node) return false;
  if (node.typ === 'thema') return canViewThema(node, user);
  const rootId = await findRootThemaId(node._id);
  if (!rootId) return true;
  const root = await Node.findById(rootId).select('sichtbarkeit typ').lean();
  return canViewThema(root, user);
}

module.exports = { findRootThemaId, canViewThema, isNodeVisible };
