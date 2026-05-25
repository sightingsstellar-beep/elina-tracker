'use strict';

const express = require('express');
const { apiError } = require('../services/api-errors');

function createCareReadRouter({
  db,
  buildReport,
  getDailyLimitForScope,
  getTimezoneForScope,
  presentDay,
  presentHistory,
  requestScope,
  resolveRequestedDayKey,
}) {
  const router = express.Router();

  router.get(['/api/today', '/api/day'], async (req, res) => {
    try {
      const dayResult = resolveRequestedDayKey({
        date: req.query.date,
        relative: req.query.relative,
      });
      if (!dayResult.ok) {
        return apiError(res, 400, dayResult.error, dayResult.code);
      }

      const scope = requestScope(req);
      const dayKey = dayResult.date;
      const summary = await db.getDaySummary(dayKey, scope);
      const [limitMl, timezone] = await Promise.all([
        getDailyLimitForScope(scope),
        getTimezoneForScope(scope),
      ]);
      res.json(presentDay(summary, { limitMl, todayDayKey: db.getDayKey(), timezone }));
    } catch (err) {
      console.error('[GET /api/today]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get('/api/report', async (req, res) => {
    try {
      const scope = requestScope(req);
      const dayKey = db.getDayKey();
      const text = await buildReport(dayKey, scope);
      res.json({ ok: true, dayKey, report: text });
    } catch (err) {
      console.error('[GET /api/report]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get('/api/history', async (req, res) => {
    try {
      const scope = requestScope(req);
      const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
      const todayKey = db.getDayKey();
      const [limitMl, timezone] = await Promise.all([
        getDailyLimitForScope(scope),
        getTimezoneForScope(scope),
      ]);

      const dayKeys = [];
      const now = new Date();
      for (let i = 0; i < days; i++) {
        const shifted = new Date(now);
        shifted.setDate(shifted.getDate() - i);
        dayKeys.push(db.getDayKey(shifted));
      }
      const uniqueKeys = [...new Set(dayKeys)].slice(0, days);

      const summaries = await db.getDaySummaries(uniqueKeys, scope);
      res.json(presentHistory(summaries, { limitMl, todayDayKey: todayKey, timezone }));
    } catch (err) {
      console.error('[GET /api/history]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createCareReadRouter };
