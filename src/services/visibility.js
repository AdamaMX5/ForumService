const Node = require('../models/Node');
const Edge = require('../models/Edge');
const { isModOrAdmin } = require('../config/roles');

const MAX_ANCESTOR_DEPTH = 50;
const TREE_EDGE_TYPES = ['pro', 'contra', 'differenzierung'];

/**
 * Walks the non-referenz parent chain (edge.von -> edge.zu) from nodeId up to the root "thema",
 * returning the full chain root-first as `{ node, edgeTyp }` pairs (node is a lean doc; edgeTyp
 * is the tree-edge connecting that node down to its own child - i.e. which pro/contra/
 * differenzierung column it hangs in under its parent - null for the root/orphan at index 0).
 * Bounded by MAX_ANCESTOR_DEPTH and a visited-set to guard against malformed/cyclic data.
 * Returns [] if nodeId itself (or, defensively, any ancestor referenced by a dangling edge)
 * can't be resolved - mirrors findRootThemaId's previous "return null" for that case.
 */
async function walkAncestorChain(nodeId) {
  const chain = [];
  let currentId = String(nodeId);
  const visited = new Set([currentId]);

  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth += 1) {
    const node = await Node.findById(currentId).lean();
    if (!node) return [];
    chain.push({ node, edgeTyp: null });

    if (node.typ === 'thema') break;

    const parentEdge = await Edge.findOne({ von: currentId, typ: { $in: TREE_EDGE_TYPES } })
      .select('zu typ')
      .lean();
    if (!parentEdge) break; // orphaned argument, treat itself as root for visibility purposes

    const nextId = String(parentEdge.zu);
    if (visited.has(nextId)) break; // cycle guard
    chain[chain.length - 1].edgeTyp = parentEdge.typ;
    visited.add(nextId);
    currentId = nextId;
  }

  chain.reverse(); // built leaf-first above, callers want root-first
  return chain;
}

/**
 * Walks the non-referenz parent chain (edge.von -> edge.zu) up to the root "thema".
 * Bounded by MAX_ANCESTOR_DEPTH and a visited-set to guard against malformed/cyclic data.
 */
async function findRootThemaId(nodeId) {
  const chain = await walkAncestorChain(nodeId);
  if (chain.length === 0) return null;
  return String(chain[0].node._id);
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

module.exports = { walkAncestorChain, findRootThemaId, canViewThema, isNodeVisible };
