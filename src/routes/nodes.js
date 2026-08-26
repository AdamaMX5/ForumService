const express = require('express');
const Node = require('../models/Node');
const Edge = require('../models/Edge');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const { writeLimiter, readLimiter } = require('../middleware/rateLimit');
const { isAdmin, isModOrAdmin } = require('../config/roles');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');
const { requireValidObjectId } = require('../utils/validateId');
const { serializeNode, serializeComment } = require('../utils/serialize');
const { buildPaginationQuery, buildNextCursor } = require('../utils/sorting');
const { getLikedIdSet, likedByMeFor } = require('../utils/likedByMe');
const { isNodeVisible, walkAncestorChain } = require('../services/visibility');
const emailService = require('../services/emailService');
const profileService = require('../services/profileService');

const router = express.Router();

const EDGE_TYPES = ['pro', 'contra', 'differenzierung'];

async function loadVisibleNode(id) {
  requireValidObjectId(id, 'node id');
  const node = await Node.findById(id);
  if (!node || node.soft_deleted) throw new HttpError(404, 'Node not found');
  return node;
}

async function assertVisible(node, user) {
  const visible = await isNodeVisible(node, user);
  if (!visible) throw new HttpError(404, 'Node not found');
}

async function loadVisible(id, user) {
  const node = await loadVisibleNode(id);
  await assertVisible(node, user);
  return node;
}

async function notifyOwner({ ownerId, actorId, subject, body }) {
  if (!ownerId || ownerId === actorId) return; // spec 7: keine Benachrichtigung bei eigener Aktivitaet
  const email = await profileService.getUserEmail(ownerId);
  if (!email) return;
  await emailService.notify({ to: email, subject, body });
}

// GET /nodes/:id
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const node = await loadVisible(req.params.id, req.user);
    const likedByMe = req.user
      ? !!(await Like.exists({ node_id: node._id, user_id: req.user.sub }))
      : undefined;
    res.json(serializeNode(node, { likedByMe }));
  })
);

// GET /nodes/:id/referenzen?limit= - ausgehende referenz-Edges dieses Nodes, aufgeloest zu den
// jeweiligen Ziel-Nodes. Ziele, die geloescht oder fuer den Aufrufer nicht sichtbar sind, werden
// stillschweigend rausgefiltert statt einen Fehler zu werfen (der Zugriff auf :id selbst ist ja
// bereits erlaubt - fehlende Sichtbarkeit eines referenzierten Ziels ist kein Fehlerfall).
router.get(
  '/:id/referenzen',
  optionalAuth,
  readLimiter,
  asyncHandler(async (req, res) => {
    const source = await loadVisible(req.params.id, req.user);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const edges = await Edge.find({ von: source._id, typ: 'referenz' })
      .sort({ erstellt_am: -1 })
      .limit(limit)
      .lean();

    if (edges.length === 0) {
      return res.json({ data: [] });
    }

    const targets = await Node.find({
      _id: { $in: edges.map((e) => e.zu) },
      soft_deleted: false,
    }).lean();
    const targetById = new Map(targets.map((t) => [String(t._id), t]));
    const likedIds = await getLikedIdSet(req.user?.sub, targets.map((t) => t._id));

    const data = [];
    for (const edge of edges) {
      const target = targetById.get(String(edge.zu));
      if (!target) continue;
      // eslint-disable-next-line no-await-in-loop
      if (!(await isNodeVisible(target, req.user))) continue;
      data.push({
        ...serializeNode(target, { likedByMe: likedByMeFor(likedIds, target._id) }),
        referenz: { id: String(edge._id), erstellt_am: edge.erstellt_am, autor_id: edge.autor_id },
      });
    }

    res.json({ data });
  })
);

// GET /nodes/:id/pfad - Pfad von der Thema-Wurzel bis zu :id (root-first), damit Clients (z.B.
// das ?fokus=-Deep-Link im Frontend) den Baum entlang dieses Pfads aufklappen koennen.
// Sichtbarkeit wird einmal auf :id selbst geprueft (loadVisible) - sie ist eine Eigenschaft der
// Thema-Wurzel und gilt fuer den kompletten Teilbaum (siehe isNodeVisible), daher keine
// Einzelpruefung pro Pfad-Element noetig.
router.get(
  '/:id/pfad',
  optionalAuth,
  readLimiter,
  asyncHandler(async (req, res) => {
    await loadVisible(req.params.id, req.user);

    const chain = await walkAncestorChain(req.params.id);
    if (chain.length === 0) throw new HttpError(404, 'Node not found');

    const likedIds = await getLikedIdSet(req.user?.sub, chain.map(({ node }) => node._id));

    res.json({
      data: chain.map(({ node, edgeTyp }) => ({
        ...serializeNode(node, { likedByMe: likedByMeFor(likedIds, node._id) }),
        edge_typ: edgeTyp,
      })),
    });
  })
);

// GET /nodes/:id/kinder?typ=pro|contra|differenzierung&sort=neu|likes|beste&cursor=&limit=
router.get(
  '/:id/kinder',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const parent = await loadVisible(req.params.id, req.user);

    const { typ, sort, cursor } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    let typFilter = EDGE_TYPES;
    if (typ) {
      if (!EDGE_TYPES.includes(typ)) throw new HttpError(400, 'Invalid typ filter');
      typFilter = [typ];
    }

    const edges = await Edge.find({ zu: parent._id, typ: { $in: typFilter } })
      .select('von typ')
      .lean();
    const edgeTypeByChild = new Map(edges.map((e) => [String(e.von), e.typ]));
    const childIds = edges.map((e) => e.von);

    if (childIds.length === 0) {
      return res.json({ data: [], nextCursor: null });
    }

    const baseFilter = { _id: { $in: childIds }, soft_deleted: false };
    const { filter, sortSpec, sortField } = buildPaginationQuery({
      baseFilter,
      sort,
      cursor,
      limit,
    });

    const items = await Node.find(filter).sort(sortSpec).limit(limit).lean();
    const likedIds = await getLikedIdSet(req.user?.sub, items.map((item) => item._id));

    res.json({
      data: items.map((item) => ({
        ...serializeNode(item, { likedByMe: likedByMeFor(likedIds, item._id) }),
        edge_typ: edgeTypeByChild.get(String(item._id)) || null,
      })),
      nextCursor: buildNextCursor(items, sortField),
    });
  })
);

// POST /nodes - neues Thema oder Argument
router.post(
  '/',
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { typ, texte, tags, anhaenge, parent_id: parentId, edge_typ: edgeTyp } = req.body || {};

    if (!['thema', 'argument'].includes(typ)) {
      throw new HttpError(400, 'typ must be "thema" or "argument"');
    }

    const providedColumns = ['neutral', 'pro', 'contra'].filter(
      (col) => typeof texte?.[col] === 'string' && texte[col].trim().length > 0
    );
    if (providedColumns.length === 0) {
      throw new HttpError(400, 'At least one of texte.neutral/pro/contra is required');
    }

    let parent = null;
    if (typ === 'argument') {
      if (!parentId || !edgeTyp) {
        throw new HttpError(400, 'parent_id and edge_typ are required for typ "argument"');
      }
      if (!EDGE_TYPES.includes(edgeTyp)) {
        throw new HttpError(400, 'edge_typ must be one of pro, contra, differenzierung');
      }
      parent = await loadVisible(parentId, req.user);
    }

    const now = new Date();
    const texteDoc = { neutral: [], pro: [], contra: [] };
    for (const col of providedColumns) {
      texteDoc[col].push({ version: 1, text: texte[col].trim(), autor_id: req.user.sub, datum: now });
    }

    const node = await Node.create({
      typ,
      texte: texteDoc,
      tags: Array.isArray(tags) ? tags : [],
      anhaenge: Array.isArray(anhaenge)
        ? anhaenge.map((a) => ({ ...a, hinzugefuegt_von: req.user.sub, datum: now }))
        : [],
      ersteller_id: req.user.sub,
      erstellt_am: now,
      sichtbarkeit: 'oeffentlich', // nur per PUT /nodes/:id/sichtbarkeit durch Admin aenderbar
    });

    if (parent) {
      await Edge.create({
        von: node._id,
        zu: parent._id,
        typ: edgeTyp,
        autor_id: req.user.sub,
      });

      await notifyOwner({
        ownerId: parent.ersteller_id,
        actorId: req.user.sub,
        subject: 'Neues Argument zu deinem Beitrag',
        body: `Es gibt ein neues Argument (${edgeTyp}) zu deinem Beitrag.`,
      });
    }

    res.status(201).json(serializeNode(node));
  })
);

// PUT /nodes/:id/text - neue Textversion (nur Mod/Admin)
router.put(
  '/:id/text',
  requireAuth,
  requireRole(isModOrAdmin),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const node = await loadVisible(req.params.id, req.user);

    const { neutral, pro, contra } = req.body || {};
    const updates = { neutral, pro, contra };
    const providedColumns = Object.keys(updates).filter(
      (col) => typeof updates[col] === 'string' && updates[col].trim().length > 0
    );
    if (providedColumns.length === 0) {
      throw new HttpError(400, 'At least one of neutral/pro/contra is required');
    }

    const now = new Date();
    for (const col of providedColumns) {
      const nextVersion = (node.texte[col]?.length || 0) + 1;
      node.texte[col].push({ version: nextVersion, text: updates[col].trim(), autor_id: req.user.sub, datum: now });
    }
    if (!node.bearbeitet_von.includes(req.user.sub)) {
      node.bearbeitet_von.push(req.user.sub);
    }
    await node.save();

    res.json(serializeNode(node));
  })
);

// PUT /nodes/:id/sichtbarkeit - nur Admin, nur Themen
router.put(
  '/:id/sichtbarkeit',
  requireAuth,
  requireRole(isAdmin),
  writeLimiter,
  asyncHandler(async (req, res) => {
    requireValidObjectId(req.params.id, 'node id');
    const node = await Node.findById(req.params.id);
    if (!node) throw new HttpError(404, 'Node not found');
    if (node.typ !== 'thema') throw new HttpError(400, 'sichtbarkeit only applies to typ "thema"');

    const { sichtbarkeit } = req.body || {};
    if (!['oeffentlich', 'privat'].includes(sichtbarkeit)) {
      throw new HttpError(400, 'sichtbarkeit must be "oeffentlich" or "privat"');
    }

    node.sichtbarkeit = sichtbarkeit;
    await node.save();

    res.json(serializeNode(node));
  })
);

// DELETE /nodes/:id - Soft-Delete (nur Mod/Admin)
router.delete(
  '/:id',
  requireAuth,
  requireRole(isModOrAdmin),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const node = await loadVisible(req.params.id, req.user);

    node.soft_deleted = true;
    node.soft_deleted_grund = (req.body && req.body.grund) || undefined;
    node.soft_deleted_von = req.user.sub;
    await node.save();

    res.status(204).end();
  })
);

// POST /nodes/:id/referenz - Referenz-Edge auf bestehenden Node anlegen
router.post(
  '/:id/referenz',
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const source = await loadVisible(req.params.id, req.user);

    const { target_node_id: targetId } = req.body || {};
    if (!targetId) throw new HttpError(400, 'target_node_id is required');
    if (String(targetId) === String(source._id)) {
      throw new HttpError(400, 'A node cannot reference itself');
    }
    const target = await loadVisible(targetId, req.user);

    const edge = await Edge.create({
      von: source._id,
      zu: target._id,
      typ: 'referenz',
      autor_id: req.user.sub,
    });

    res.status(201).json({
      id: String(edge._id),
      von: String(edge.von),
      zu: String(edge.zu),
      typ: edge.typ,
    });
  })
);

// POST /nodes/:id/likes
router.post(
  '/:id/likes',
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const node = await loadVisible(req.params.id, req.user);

    try {
      await Like.create({ node_id: node._id, user_id: req.user.sub });
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, 'Already liked');
      throw err;
    }

    const updated = await Node.findByIdAndUpdate(
      node._id,
      { $inc: { likes_count: 1 } },
      { new: true }
    ).lean();

    res.status(201).json({ likes_count: updated.likes_count });
  })
);

// DELETE /nodes/:id/likes
router.delete(
  '/:id/likes',
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    requireValidObjectId(req.params.id, 'node id');

    const deleted = await Like.findOneAndDelete({ node_id: req.params.id, user_id: req.user.sub });
    if (!deleted) throw new HttpError(404, 'Like not found');

    const updated = await Node.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes_count: -1 } },
      { new: true }
    ).lean();

    res.json({ likes_count: updated ? updated.likes_count : 0 });
  })
);

// GET /nodes/:id/kommentare?cursor=&limit=
router.get(
  '/:id/kommentare',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const node = await loadVisible(req.params.id, req.user);

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const { filter, sortSpec, sortField } = buildPaginationQuery({
      baseFilter: { node_id: node._id },
      sort: 'chronologisch',
      cursor: req.query.cursor,
      limit,
    });

    const items = await Comment.find(filter).sort(sortSpec).limit(limit).lean();

    res.json({
      data: items.map(serializeComment),
      nextCursor: buildNextCursor(items, sortField),
    });
  })
);

// POST /nodes/:id/kommentare
router.post(
  '/:id/kommentare',
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const node = await loadVisible(req.params.id, req.user);

    const { text, parent_comment_id: parentCommentId } = req.body || {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new HttpError(400, 'text is required');
    }

    if (parentCommentId) {
      requireValidObjectId(parentCommentId, 'parent_comment_id');
      const parentComment = await Comment.findOne({ _id: parentCommentId, node_id: node._id });
      if (!parentComment) throw new HttpError(400, 'parent_comment_id does not belong to this node');
    }

    const comment = await Comment.create({
      node_id: node._id,
      parent_comment_id: parentCommentId || null,
      text: text.trim(),
      autor_id: req.user.sub,
    });

    await Node.findByIdAndUpdate(node._id, { $inc: { comments_count: 1 } });

    await notifyOwner({
      ownerId: node.ersteller_id,
      actorId: req.user.sub,
      subject: 'Neuer Kommentar zu deinem Beitrag',
      body: 'Es gibt einen neuen Kommentar zu deinem Beitrag.',
    });

    res.status(201).json(serializeComment(comment));
  })
);

module.exports = router;
