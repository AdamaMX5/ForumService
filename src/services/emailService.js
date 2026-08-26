const fetch = require('cross-fetch');
const env = require('../config/env');
const { joinUrl } = require('../utils/joinUrl');

/**
 * Fire-and-forget notification trigger (spec section 7). Never blocks or fails the
 * originating request — a notification is best-effort, not part of the write's contract.
 */
async function notify({ to, subject, body }) {
  if (!env.emailServiceUrl || !env.internalApiKey) return;
  try {
    await fetch(joinUrl(env.emailServiceUrl, '/emails'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.internalApiKey,
      },
      body: JSON.stringify({ to, subject, body, type: 'forum_notification' }),
    });
  } catch (err) {
    console.error('EmailService notification failed:', err.message);
  }
}

module.exports = { notify };
