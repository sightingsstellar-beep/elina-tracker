'use strict';

const express = require('express');

function createWeightRouter({
  db,
  publishCareChange,
  requestScope,
  resolveRequestedDayKey,
  validateLogDate,
}) {
  const router = express.Router();

  /**
   * POST /api/weight
   * Body: { weight_kg, notes? }
   * Logs weight for today's fluid day key. Returns { ok, weight_kg, date, replaced }.
   */
  router.post('/api/weight', async (req, res) => {
    try {
      const scope = requestScope(req);
      const { weight_kg, notes } = req.body;
      if (typeof weight_kg !== 'number' || weight_kg <= 0) {
        return res.status(400).json({ ok: false, error: 'weight_kg must be a positive number' });
      }

      const dateResult = validateLogDate(req.body.date);
      if (!dateResult.ok) {
        return res.status(400).json({ ok: false, error: dateResult.error });
      }
      const date = dateResult.date;

      const existing = await db.getWeightForDate(date, scope);
      await db.logWeight(date, weight_kg, notes ?? null, scope);
      publishCareChange(scope, { action: existing ? 'update' : 'create', source: 'api-weight', dayKey: date });
      res.json({ ok: true, weight_kg, date, replaced: !!existing });
    } catch (err) {
      console.error('[POST /api/weight]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/weight/today
   * Returns the requested day's weight entry or { ok, weight: null }.
   */
  router.get('/api/weight/today', async (req, res) => {
    try {
      const scope = requestScope(req);
      const dayResult = resolveRequestedDayKey({
        date: req.query.date,
        relative: req.query.relative,
      });
      if (!dayResult.ok) {
        return res.status(400).json({ ok: false, error: dayResult.error });
      }

      const date = dayResult.date;
      const entry = await db.getWeightForDate(date, scope);
      res.json({ ok: true, date, weight: entry || null });
    } catch (err) {
      console.error('[GET /api/weight/today]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/weight/history?days=7
   * Returns last N weight entries ordered by date desc.
   */
  router.get('/api/weight/history', async (req, res) => {
    try {
      const scope = requestScope(req);
      const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
      let entries;

      if (req.query.throughDate) {
        const dateResult = validateLogDate(req.query.throughDate);
        if (!dateResult.ok) {
          return res.status(400).json({ ok: false, error: dateResult.error });
        }
        entries = await db.getWeightHistoryUpTo(dateResult.date, days, scope);
      } else {
        entries = await db.getWeightHistory(days, scope);
      }

      res.json({ ok: true, entries });
    } catch (err) {
      console.error('[GET /api/weight/history]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * DELETE /api/weight/:date
   * Remove a specific day weight entry.
   */
  router.delete('/api/weight/:date', async (req, res) => {
    try {
      const scope = requestScope(req);
      const dateResult = validateLogDate(req.params.date);
      if (!dateResult.ok) {
        return res.status(400).json({ ok: false, error: dateResult.error });
      }

      const result = await db.deleteWeight(dateResult.date, scope);
      if (result.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Weight entry not found' });
      }

      publishCareChange(scope, { action: 'delete', source: 'api-weight', dayKey: dateResult.date });
      res.json({ ok: true, deleted: dateResult.date });
    } catch (err) {
      console.error('[DELETE /api/weight/:date]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createWeightRouter };
