const fetch = require('cross-fetch');
const env = require('../config/env');
const { joinUrl } = require('../utils/joinUrl');

/**
 * Best-effort lookup of a user's email via ProfileService, used to address notifications.
 * Returns null on any failure so callers can silently skip the notification.
 */
async function getUserEmail(userId) {
  if (!env.profileServiceUrl) return null;
  try {
    const response = await fetch(
      joinUrl(env.profileServiceUrl, `/profile/${encodeURIComponent(userId)}/global`)
    );
    if (!response.ok) return null;
    const body = await response.json();
    return body?.email || null;
  } catch (err) {
    console.error('ProfileService lookup failed:', err.message);
    return null;
  }
}

module.exports = { getUserEmail };
