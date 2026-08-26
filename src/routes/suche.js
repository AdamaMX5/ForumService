const express = require('express');
const Node = require('../models/Node');
const { optionalAuth } = require('../middleware/auth');
const { isModOrAdmin } = require('../config/roles');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');
const { serializeNode } = require('../utils/serialize');
const { isNodeVisible } = require('../services/visibility');

const router = express.Router();

// GET /suche?q=...
// Volltextsuche ueber texte.neutral/pro/contra.text (MongoDB Text-Index, siehe Spec Abschnitt 9).
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) throw new HttpError(400, 'q is required');

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const privileged = isModOrAdmin(req.user);
    // Ueber-fetchen, weil private Themen/Argumente danach noch pro Treffer per isNodeVisible
    // rausgefiltert werden - der Text-Index selbst kennt Sichtbarkeit nicht.
    const candidateLimit = privileged ? limit : limit * 3;

    const candidates = await Node.find(
      { soft_deleted: false, $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(candidateLimit)
      .lean();

    let items = candidates;
    if (!privileged) {
      items = [];
      for (const candidate of candidates) {
        if (items.length >= limit) break;
        // eslint-disable-next-line no-await-in-loop
        if (await isNodeVisible(candidate, req.user)) items.push(candidate);
      }
    } else {
      items = candidates.slice(0, limit);
    }

    res.json({ data: items.map(serializeNode) });
  })
);

module.exports = router;
