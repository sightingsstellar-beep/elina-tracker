'use strict';

const express = require('express');

function createSettingsRouter({ db, requestScope }) {
  const router = express.Router();

  /**
   * GET /api/settings
   * Returns all settings as a flat object.
   */
  router.get('/api/settings', async (req, res) => {
    try {
      const settings = await db.getSettings(requestScope(req));
      res.json({ ok: true, ...settings });
    } catch (err) {
      console.error('[GET /api/settings]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * POST /api/settings
   * Accepts partial object, updates provided keys, returns updated settings.
   */
  router.post('/api/settings', async (req, res) => {
    try {
      const scope = requestScope(req);
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ ok: false, error: 'Invalid request body' });
      }
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
          await db.setSetting(key, value, scope);
        }
      }
      const settings = await db.getSettings(scope);
      res.json({ ok: true, ...settings });
    } catch (err) {
      console.error('[POST /api/settings]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createSettingsRouter };
