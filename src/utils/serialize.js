// Spec section 3.1: "Nur letzte Version wird angezeigt, komplette History bleibt im Array
// erhalten" - the API surfaces only the current (last) version per text column.
function currentVersion(versions) {
  if (!versions || versions.length === 0) return null;
  return versions[versions.length - 1];
}

function serializeNode(node) {
  return {
    id: String(node._id),
    typ: node.typ,
    texte: {
      neutral: currentVersion(node.texte?.neutral),
      pro: currentVersion(node.texte?.pro),
      contra: currentVersion(node.texte?.contra),
    },
    tags: (node.tags || []).map(String),
    anhaenge: node.anhaenge || [],
    ersteller_id: node.ersteller_id,
    erstellt_am: node.erstellt_am,
    likes_count: node.likes_count,
    comments_count: node.comments_count,
    bearbeitet_von: node.bearbeitet_von || [],
    soft_deleted: node.soft_deleted,
    soft_deleted_grund: node.soft_deleted_grund,
    soft_deleted_von: node.soft_deleted_von,
    ...(node.typ === 'thema' ? { sichtbarkeit: node.sichtbarkeit } : {}),
  };
}

function serializeComment(comment) {
  return {
    id: String(comment._id),
    node_id: String(comment.node_id),
    parent_comment_id: comment.parent_comment_id ? String(comment.parent_comment_id) : null,
    text: comment.soft_deleted ? null : comment.text,
    autor_id: comment.autor_id,
    erstellt_am: comment.erstellt_am,
    soft_deleted: comment.soft_deleted,
  };
}

module.exports = { currentVersion, serializeNode, serializeComment };
