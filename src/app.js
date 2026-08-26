const express = require('express');
const healthRouter = require('./routes/health');
const themenRouter = require('./routes/themen');
const nodesRouter = require('./routes/nodes');
const sucheRouter = require('./routes/suche');
const adminRouter = require('./routes/admin');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // CORS wird zentral auf NGINX-Ebene gehandhabt (siehe Architecture.md), nicht hier.
  app.use(express.json({ limit: '256kb' }));

  app.use('/', healthRouter);
  app.use('/themen', themenRouter);
  app.use('/nodes', nodesRouter);
  app.use('/suche', sucheRouter);
  app.use('/admin', adminRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
