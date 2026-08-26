const mongoose = require('mongoose');
const env = require('../config/env');

async function connectMongo() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongodbUri);
  return mongoose.connection;
}

async function disconnectMongo() {
  await mongoose.disconnect();
}

module.exports = { connectMongo, disconnectMongo };
