'use strict';

const express = require('express');

function createChatRouter({
  db,
  formatFluidType,
  formatPoopSubtype,
  getDailyLimitForScope,
  parseMessage,
  publishCareChange,
  requestScope,
}) {
  const router = express.Router();

  async function buildChatConfirmation(actions, summary, scope = {}) {
    const parts = [];
    for (const action of actions) {
      if (action.type === 'input') {
        const label = formatFluidType(action.fluid_type);
        const amount = action.amount_ml ? `${action.amount_ml}ml` : '(no amount)';
        parts.push(`${amount} ${label}`);
      } else if (action.type === 'output') {
        const label = formatFluidType(action.fluid_type);
        const amount = action.amount_ml ? ` ${action.amount_ml}ml` : '';
        if (action.fluid_type === 'poop' && action.subtype) {
          const subtypeLabel = formatPoopSubtype(action.subtype) || action.subtype;
          parts.push(`${label} (${subtypeLabel.toLowerCase()})${amount} (output)`);
        } else {
          parts.push(`${label}${amount} (output)`);
        }
      } else if (action.type === 'wellness') {
        parts.push(`Wellness check (${action.check_time})`);
      } else if (action.type === 'gag') {
        parts.push(`Gag ×${action.count}`);
      }
    }
    const logged = parts.length > 0 ? parts.join(' + ') : 'entry';
    const limit = await getDailyLimitForScope(scope);
    const pct = Math.round((summary.totalIntake / limit) * 100);

    const totalOut = summary.outputs.reduce((sum, o) => sum + (o.amount_ml || 0), 0);
    const outStr = totalOut > 0 ? `${totalOut}g` : `${summary.outputs.length} event${summary.outputs.length !== 1 ? 's' : ''}`;

    return `Logged: ${logged} | Total In: ${summary.totalIntake}/${limit}ml (${pct}%) · Total Out: ${outStr}`;
  }

  router.post('/api/chat', async (req, res) => {
    try {
      const scope = requestScope(req);
      const { text } = req.body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ ok: false, error: 'Missing or empty text' });
      }

      let parsed;
      try {
        parsed = await parseMessage(text.trim());
      } catch (err) {
        console.error('[POST /api/chat] Parser error:', err.message);
        return res.status(500).json({ ok: false, error: 'Parser error: ' + err.message });
      }

      if (parsed.unparseable || parsed.actions.length === 0) {
        return res.json({
          ok: false,
          message: 'I couldn\'t understand that. Try something like: "120ml pediasure" or "pee 80ml" or "gag x2".',
          entries: [],
        });
      }

      const missingAmount = parsed.actions.find((a) => {
        if (a.type === 'input') return !a.amount_ml;
        if (a.type === 'output') return !a.amount_ml;
        return false;
      });
      if (missingAmount) {
        const label = formatFluidType(missingAmount.fluid_type);
        return res.json({
          ok: false,
          message: `I need a measurement for ${label}. How many ml was it? (e.g. "${label} 80ml")`,
          entries: [],
        });
      }

      const now = Date.now();
      const dayKey = db.getDayKey();
      const entries = [];

      for (const action of parsed.actions) {
        if (action.type === 'input' || action.type === 'output') {
          const entry = await db.logEntry({
            timestamp: now,
            day_key: dayKey,
            entry_type: action.type,
            fluid_type: action.fluid_type,
            amount_ml: action.amount_ml,
            subtype: action.subtype ?? null,
            source: 'chat',
            ...scope,
          });
          entries.push({ kind: action.type, ...action, id: entry?.id });
        } else if (action.type === 'wellness') {
          await db.logWellness({
            timestamp: now,
            day_key: dayKey,
            check_time: action.check_time,
            appetite: action.appetite,
            energy: action.energy,
            mood: action.mood,
            cyanosis: action.cyanosis,
            ...scope,
          });
          entries.push({ kind: 'wellness', ...action });
        } else if (action.type === 'gag') {
          await db.logGag(action.count, now, null, scope);
          entries.push({ kind: 'gag', count: action.count });
        }
      }

      const summary = await db.getDaySummary(dayKey, scope);
      const message = await buildChatConfirmation(parsed.actions, summary, scope);
      publishCareChange(scope, { action: 'create', source: 'api-chat', dayKey });

      res.json({ ok: true, message, entries, dayKey });
    } catch (err) {
      console.error('[POST /api/chat]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createChatRouter };
