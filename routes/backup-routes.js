'use strict';

const express = require('express');

function createBackupRouter({ apiKey, db }) {
  const router = express.Router();

  router.get('/api/backup', async (req, res) => {
    if (!apiKey || req.headers['x-api-key'] !== apiKey) {
      return res.status(403).json({ ok: false, error: 'API key required for backup' });
    }
    try {
      const datestamp = new Date().toISOString().slice(0, 10);
      const data = await db.exportAllData();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=elina-postgres-backup-${datestamp}.json`);
      res.send(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[GET /api/backup]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createBackupRouter };
