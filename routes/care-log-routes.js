'use strict';

const express = require('express');

function createCareLogRouter({
  db,
  formatFluidType,
  formatTimeInput,
  formatTimestamp,
  getTimezone,
  publishCareChange,
  requestScope,
  validateLogDate,
  validateLogTime,
  zonedDateTimeToTimestamp,
}) {
  const router = express.Router();

  /**
   * POST /api/log
   * Log a fluid entry, wellness check, or gag event directly via API.
   * Body: { entry_type, fluid_type, amount_ml, notes, source }
   *   OR  { type: 'wellness', check_time, appetite, energy, mood, cyanosis }
   *   OR  { type: 'gag', count }
   */
  router.post('/api/log', async (req, res) => {
    try {
      const scope = requestScope(req);
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ ok: false, error: 'Invalid request body' });
      }

      const dateResult = validateLogDate(body.date);
      if (!dateResult.ok) {
        return res.status(400).json({ ok: false, error: dateResult.error });
      }
      const timeResult = validateLogTime(body.time);
      if (!timeResult.ok) {
        return res.status(400).json({ ok: false, error: timeResult.error });
      }
      const dayKey = dateResult.date;
      const tz = getTimezone();
      const overrideTimestamp = timeResult.time
        ? zonedDateTimeToTimestamp(dayKey, timeResult.time, tz)
        : null;

      const results = [];

      if (body.type !== 'wellness' && body.type !== 'gag') {
        const isPoop = body.fluid_type === 'poop';
        if (!isPoop && (!body.amount_ml || typeof body.amount_ml !== 'number' || body.amount_ml <= 0)) {
          return res.status(400).json({ ok: false, error: 'amount_ml is required for input and output entries' });
        }
      }

      if (body.type === 'wellness') {
        const w = await db.upsertWellness({
          day_key: dayKey,
          check_time: body.check_time || '5pm',
          appetite: body.appetite ?? null,
          energy: body.energy ?? null,
          mood: body.mood ?? null,
          cyanosis: body.cyanosis ?? null,
          source: 'api',
          ...scope,
        });
        results.push({ kind: 'wellness', data: w });
      } else if (body.type === 'gag') {
        const count = Math.max(1, parseInt(body.count, 10) || 1);
        const gags = await db.logGag(count, overrideTimestamp || Date.now(), dayKey, scope);
        results.push({ kind: 'gag', count, data: gags });
      } else {
        const entry = await db.logEntry({
          timestamp: overrideTimestamp || Date.now(),
          day_key: dayKey,
          entry_type: body.entry_type,
          fluid_type: body.fluid_type,
          amount_ml: body.amount_ml ?? null,
          subtype: body.subtype ?? null,
          notes: body.notes ?? null,
          source: 'api',
          ...scope,
        });
        results.push({ kind: 'fluid', data: entry });
      }

      const summary = await db.getDaySummary(db.getDayKey(), scope);
      publishCareChange(scope, { action: 'create', source: 'api-log', dayKey });
      res.json({ ok: true, results, totalIntake: summary.totalIntake });
    } catch (err) {
      console.error('[POST /api/log]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * PATCH /api/log/:id
   * Update a specific fluid input/output entry.
   */
  router.patch('/api/log/:id', async (req, res) => {
    try {
      const scope = requestScope(req);
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) {
        return res.status(400).json({ ok: false, error: 'Invalid ID' });
      }

      const existing = await db.getLogById(id, scope);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Entry not found' });
      }

      const body = req.body || {};
      const entryType = body.entry_type || existing.entry_type;
      const fluidType = body.fluid_type || existing.fluid_type;
      const dateResult = validateLogDate(body.date || existing.day_key);
      if (!dateResult.ok) {
        return res.status(400).json({ ok: false, error: dateResult.error });
      }
      const timeResult = validateLogTime(body.time || formatTimeInput(existing.timestamp));
      if (!timeResult.ok) {
        return res.status(400).json({ ok: false, error: timeResult.error });
      }

      const isPoop = fluidType === 'poop';
      const hasAmount = Object.prototype.hasOwnProperty.call(body, 'amount_ml');
      const amountMl = hasAmount ? body.amount_ml : existing.amount_ml;
      if (!isPoop && (typeof amountMl !== 'number' || amountMl <= 0)) {
        return res.status(400).json({ ok: false, error: 'amount_ml is required for input and output entries' });
      }

      const timestamp = zonedDateTimeToTimestamp(dateResult.date, timeResult.time, getTimezone());

      await db.updateLog({
        id,
        timestamp,
        day_key: dateResult.date,
        entry_type: entryType,
        fluid_type: fluidType,
        amount_ml: isPoop ? (amountMl ?? null) : amountMl,
        subtype: body.subtype ?? existing.subtype ?? null,
        notes: body.notes ?? existing.notes ?? null,
        ...scope,
      });

      const updated = await db.getLogById(id, scope);
      publishCareChange(scope, { action: 'update', source: 'api-log', dayKey: updated?.day_key || dateResult.date, id });
      res.json({
        ok: true,
        entry: {
          ...updated,
          time: formatTimestamp(updated.timestamp),
          time24: formatTimeInput(updated.timestamp),
          fluid_type_label: formatFluidType(updated.fluid_type),
        },
      });
    } catch (err) {
      console.error('[PATCH /api/log/:id]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * DELETE /api/log/:id
   * Remove a specific log entry by ID.
   */
  router.delete('/api/log/:id', async (req, res) => {
    try {
      const scope = requestScope(req);
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) {
        return res.status(400).json({ ok: false, error: 'Invalid ID' });
      }
      const result = await db.deleteLog(id, scope);
      if (result.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Entry not found' });
      }
      publishCareChange(scope, { action: 'delete', source: 'api-log', id });
      res.json({ ok: true, deleted: id });
    } catch (err) {
      console.error('[DELETE /api/log/:id]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * PATCH /api/gag/:id
   * Update a specific gag event time/day.
   */
  router.patch('/api/gag/:id', async (req, res) => {
    try {
      const scope = requestScope(req);
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) {
        return res.status(400).json({ ok: false, error: 'Invalid ID' });
      }

      const existing = await db.getGagById(id, scope);
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Gag entry not found' });
      }

      const body = req.body || {};
      const dateResult = validateLogDate(body.date || existing.day_key);
      if (!dateResult.ok) {
        return res.status(400).json({ ok: false, error: dateResult.error });
      }
      const timeResult = validateLogTime(body.time || formatTimeInput(existing.timestamp));
      if (!timeResult.ok) {
        return res.status(400).json({ ok: false, error: timeResult.error });
      }

      const timestamp = zonedDateTimeToTimestamp(dateResult.date, timeResult.time, getTimezone());
      await db.updateGag({ id, timestamp, day_key: dateResult.date, ...scope });

      const updated = await db.getGagById(id, scope);
      publishCareChange(scope, { action: 'update', source: 'api-gag', dayKey: updated?.day_key || dateResult.date, id });
      res.json({ ok: true, entry: { ...updated, time: formatTimestamp(updated.timestamp), time24: formatTimeInput(updated.timestamp) } });
    } catch (err) {
      console.error('[PATCH /api/gag/:id]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * DELETE /api/gag/:id
   * Remove a specific gag event by ID.
   */
  router.delete('/api/gag/:id', async (req, res) => {
    try {
      const scope = requestScope(req);
      const id = parseInt(req.params.id, 10);
      if (!id || isNaN(id)) {
        return res.status(400).json({ ok: false, error: 'Invalid ID' });
      }
      const result = await db.deleteGag(id, scope);
      if (result.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Gag entry not found' });
      }
      publishCareChange(scope, { action: 'delete', source: 'api-gag', id });
      res.json({ ok: true, deleted: id });
    } catch (err) {
      console.error('[DELETE /api/gag/:id]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * DELETE /api/wellness?date=YYYY-MM-DD&check_time=5pm|10pm
   * Remove a specific wellness entry for the day/period.
   */
  router.delete('/api/wellness', async (req, res) => {
    try {
      const scope = requestScope(req);
      const dateResult = validateLogDate(req.query.date);
      if (!dateResult.ok) {
        return res.status(400).json({ ok: false, error: dateResult.error });
      }

      const checkTime = req.query.check_time;
      if (!['5pm', '10pm'].includes(checkTime)) {
        return res.status(400).json({ ok: false, error: 'Invalid check_time. Use 5pm or 10pm.' });
      }

      const result = await db.deleteWellness(dateResult.date, checkTime, scope);
      if (result.changes === 0) {
        return res.status(404).json({ ok: false, error: 'Wellness entry not found' });
      }

      publishCareChange(scope, { action: 'delete', source: 'api-wellness', dayKey: dateResult.date });
      res.json({ ok: true, deleted: { date: dateResult.date, check_time: checkTime } });
    } catch (err) {
      console.error('[DELETE /api/wellness]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createCareLogRouter };
