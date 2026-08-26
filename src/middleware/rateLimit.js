const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Per-user rate limiting on writing endpoints (create node/comment, like), see spec section 14.
// Falls back to IP when unauthenticated (shouldn't normally happen since these routes require auth).
const writeLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.sub) || req.ip,
  message: { error: 'Too many requests, please slow down.' },
});

module.exports = { writeLimiter };
