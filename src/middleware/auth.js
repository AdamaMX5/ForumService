const jwt = require('jsonwebtoken');
const { getPublicKey } = require('../services/authKeyService');
const { HttpError } = require('../utils/httpError');

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

function verifyToken(token) {
  const publicKey = getPublicKey();
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}

/**
 * Attaches req.user if a valid JWT is present, but never rejects the request.
 * Used on read endpoints, which are public per spec section 14 (with the exception
 * of private themes, enforced separately via visibility checks).
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.user = verifyToken(token);
  } catch (err) {
    // Invalid/expired token on an optional-auth route: treat as anonymous rather than failing.
  }
  next();
}

/**
 * Rejects the request unless a valid JWT is present. Used on all writing endpoints.
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    req.user = verifyToken(token);
  } catch (err) {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
  next();
}

function requireRole(check) {
  return (req, res, next) => {
    if (!check(req.user)) {
      return next(new HttpError(403, 'Insufficient permissions'));
    }
    next();
  };
}

module.exports = { optionalAuth, requireAuth, requireRole };
