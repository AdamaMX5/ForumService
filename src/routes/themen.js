const express = require('express');
const Node = require('../models/Node');
const { optionalAuth } = require('../middleware/auth');
const { isModOrAdmin } = require('../config/roles');
const { asyncHandler } = require('../utils/asyncHandler');
const { serializeNode } = require('../utils/serialize');
const { buildPaginationQuery, buildNextCursor } = require('../utils/sorting');
const { getLikedIdSet, likedByMeFor } = require('../utils/likedByMe');

const router = express.Router();

// GET /themen?tags=...&sort=neu|likes|beste&cursor=&limit=
// Nicht eingeloggte oder nicht-privilegierte User bekommen private Themen nicht gelistet
// (spec 3.1) - sie werden hier serverseitig aus dem Filter ausgeschlossen, kein Nachfiltern.
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { tags, sort, cursor } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const baseFilter = { typ: 'thema', soft_deleted: false };
    if (!isModOrAdmin(req.user)) {
      baseFilter.sichtbarkeit = 'oeffentlich';
    }
    if (tags) {
      const tagIds = String(tags)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagIds.length > 0) baseFilter.tags = { $in: tagIds };
    }

    const { filter, sortSpec, sortField } = buildPaginationQuery({
      baseFilter,
      sort,
      cursor,
      limit,
    });

    const items = await Node.find(filter).sort(sortSpec).limit(limit).lean();
    const likedIds = await getLikedIdSet(req.user?.sub, items.map((item) => item._id));

    res.json({
      data: items.map((item) => serializeNode(item, { likedByMe: likedByMeFor(likedIds, item._id) })),
      nextCursor: buildNextCursor(items, sortField),
    });
  })
);

module.exports = router;
