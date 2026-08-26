process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth.test.invalid';
process.env.MONGODB_URI = 'unused-in-tests';
process.env.NODE_ENV = 'test';
// writeLimiter's in-memory store is created once per `createApp()` call and lives for the whole
// test file run (not reset between tests), so unrelated write-heavy tests sharing the same
// author/admin sub can otherwise tip a later, unrelated test over the production default (30/min)
// and turn it into a flaky 429. No test in this suite exercises rate-limiting behavior itself, so
// raise the limit here rather than coupling unrelated tests to it.
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '100000';
process.env.RATE_LIMIT_READ_MAX = process.env.RATE_LIMIT_READ_MAX || '100000';
