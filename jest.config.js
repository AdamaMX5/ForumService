module.exports = {
  testEnvironment: 'node',
  testTimeout: 20000,
  setupFiles: ['<rootDir>/tests/env.setup.js'],
  // Jest's default testMatch walks the whole repo tree - without this, it also picks up
  // frontend/src/**/*.test.ts(x) (a separate Vitest project, TS/JSX, its own test runner) and
  // fails to parse them since this config has no TS/JSX transform.
  roots: ['<rootDir>/tests'],
};
