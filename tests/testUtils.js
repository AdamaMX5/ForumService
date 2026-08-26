const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { setPublicKeyForTests } = require('../src/services/authKeyService');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

let mongoServer;

async function setupDb() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  setPublicKeyForTests(publicKey);
}

async function teardownDb() {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

async function clearDb() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

function makeToken({ sub = 'user-1', email = 'user@example.com', roles = [], permissions = {} } = {}) {
  return jwt.sign({ sub, email, roles, permissions }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
}

module.exports = { setupDb, teardownDb, clearDb, makeToken };
