const env = require('./config/env');
const { createApp } = require('./app');
const { connectMongo } = require('./db/mongo');
const { loadPublicKey } = require('./services/authKeyService');

async function main() {
  // JWT-Public-Key wird einmalig beim Start vom AuthService geladen (Spec Abschnitt 2) -
  // faellt der Service beim Start weg, kann der Prozess ohne gueltigen Key ohnehin keine
  // JWTs verifizieren, also lieber frueh und laut scheitern als still unauthentifiziert laufen.
  await loadPublicKey();
  await connectMongo();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`ForumService listening on port ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error('Failed to start ForumService:', err);
  process.exit(1);
});
