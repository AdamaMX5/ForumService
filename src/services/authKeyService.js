const fetch = require('cross-fetch');
const env = require('../config/env');
const { joinUrl } = require('../utils/joinUrl');

/**
 * Holds the RS256 public key used to verify JWTs, fetched at runtime from AuthService.
 * Never read from .env or hardcoded (see spec section 2). Cached in memory, with a
 * manual refresh hook exposed via POST /admin/refresh-key for the rare case the key rotates.
 */
let cachedPublicKey = null;

async function fetchPublicKey() {
  const url = joinUrl(env.authServiceUrl, '/jwt/public-key');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWT public key from AuthService: ${response.status}`);
  }
  const body = await response.json();
  if (!body.public_key) {
    throw new Error('AuthService response did not contain public_key');
  }
  cachedPublicKey = body.public_key;
  return cachedPublicKey;
}

async function loadPublicKey() {
  return fetchPublicKey();
}

function getPublicKey() {
  if (!cachedPublicKey) {
    throw new Error('JWT public key not loaded yet');
  }
  return cachedPublicKey;
}

async function refreshPublicKey() {
  return fetchPublicKey();
}

// Test-only seam: lets the test suite inject a key without hitting the network.
// Never used by production code paths (those always go through fetchPublicKey).
function setPublicKeyForTests(key) {
  cachedPublicKey = key;
}

module.exports = { loadPublicKey, getPublicKey, refreshPublicKey, setPublicKeyForTests };
