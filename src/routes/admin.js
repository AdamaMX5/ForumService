const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isAdmin } = require('../config/roles');
const { refreshPublicKey } = require('../services/authKeyService');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.post(
  '/refresh-key',
  requireAuth,
  requireRole(isAdmin),
  asyncHandler(async (req, res) => {
    await refreshPublicKey();
    res.json({ status: 'ok' });
  })
);

module.exports = router;
