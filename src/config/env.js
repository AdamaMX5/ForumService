require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: required('MONGODB_URI', 'mongodb://localhost:27017/forum-service'),
  authServiceUrl: required('AUTH_SERVICE_URL'),
  emailServiceUrl: process.env.EMAIL_SERVICE_URL,
  profileServiceUrl: process.env.PROFILE_SERVICE_URL,
  mediaServiceUrl: process.env.MEDIA_SERVICE_URL,
  internalApiKey: process.env.INTERNAL_API_KEY,
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  rateLimitReadMax: parseInt(process.env.RATE_LIMIT_READ_MAX || '100', 10),
};
