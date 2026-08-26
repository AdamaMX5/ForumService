const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'ForumService' });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ForumService', timestamp: new Date().toISOString() });
});

module.exports = router;
