const express = require('express');
const { gitVersionHash } = require('../utils/gitVersion');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: `Hello World! I'm the ForumService: ${gitVersionHash}` });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ForumService', timestamp: new Date().toISOString() });
});

module.exports = router;
