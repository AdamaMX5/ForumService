const { execSync } = require('child_process');
const path = require('path');

// Resolved once at startup (not per-request) - matches the frontend build-time git hash
// convention, just read at process start instead of baked in by a bundler.
function resolveGitVersionHash() {
  if (process.env.GIT_COMMIT_SHA) {
    return process.env.GIT_COMMIT_SHA.slice(0, 12);
  }
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: path.join(__dirname, '..', '..'),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const gitVersionHash = resolveGitVersionHash();

module.exports = { gitVersionHash };
