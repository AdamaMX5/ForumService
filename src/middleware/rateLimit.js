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

// Read endpoints are public and normally O(page size), so they don't need rate limiting - but
// GET /nodes/:id/pfad walks up to MAX_ANCESTOR_DEPTH ancestor levels (2 Mongo queries each) per
// request, and GET /nodes/:id/referenzen resolves+visibility-checks up to 100 target nodes. Both
// are unauthenticated-reachable and meaningfully more expensive than a typical GET, so they get a
// deliberately generous (much higher than writeLimiter) IP/user-based limit as a DoS-amplification
// guard rather than a genuine usage cap (see security review).
const readLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitReadMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.sub) || req.ip,
  message: { error: 'Too many requests, please slow down.' },
});

module.exports = { writeLimiter, readLimiter };
