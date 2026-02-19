/**
 * scheduler.js — Cron jobs for automated reports and day resets
 *
 * Schedule (all times in timezone configured in settings):
 *   report_time_1 (default 7:00 PM) — evening handoff report
 *   report_time_2 (default 10:00 PM) — night report
 */

'use strict';

const cron = require('node-cron');
const db = require('./db');
const { buildReport } = require('./server');

// We lazy-require the bot to avoid circular dependency issues at startup
function getBot() {
  return require('./bot');
}

const AUTHORIZED_IDS = (process.env.AUTHORIZED_USER_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => parseInt(s, 10));

// Read timezone from settings (with env fallback)
const tz = db.getSetting('timezone') || process.env.TZ || 'America/New_York';

/**
 * Send a report to all authorized users.
 */
async function sendScheduledReport(label) {
  if (AUTHORIZED_IDS.length === 0) {
    console.warn('[scheduler] No authorized users configured — skipping report send');
    return;
  }

  let bot;
  try {
    bot = getBot();
  } catch (err) {
    console.error('[scheduler] Could not get bot instance:', err.message);
    return;
  }

  const dayKey = db.getDayKey();
  let report;
  try {
    report = buildReport(dayKey);
  } catch (err) {
    console.error('[scheduler] Error building report:', err.message);
    report = `❌ Error generating ${label} report: ${err.message}`;
  }

  for (const userId of AUTHORIZED_IDS) {
    try {
      await bot.sendMessage(userId, report);
      console.log(`[scheduler] ${label} report sent to user ${userId}`);
    } catch (err) {
      // Common cause: user hasn't started the bot yet (403 Forbidden)
      console.error(`[scheduler] Failed to send report to ${userId}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Parse report times from settings
// ---------------------------------------------------------------------------

/**
 * Parse "HH:MM" time string into a cron expression "MM HH * * *"
 * Falls back to provided default if parsing fails.
 */
function timeToCron(timeStr, defaultHour, defaultMin) {
  const parts = (timeStr || '').split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
    return `${m} ${h} * * *`;
  }
  return `${defaultMin} ${defaultHour} * * *`;
}

const report1Time = db.getSetting('report_time_1') || '19:00';
const report2Time = db.getSetting('report_time_2') || '22:00';

const cron1 = timeToCron(report1Time, 19, 0);
const cron2 = timeToCron(report2Time, 22, 0);

// ---------------------------------------------------------------------------
// Cron schedules
// ---------------------------------------------------------------------------

// First report (default 7:00 PM) — evening handoff report
cron.schedule(
  cron1,
  () => {
    console.log(`[scheduler] Triggering ${report1Time} report`);
    sendScheduledReport(report1Time).catch(console.error);
  },
  { timezone: tz }
);

// Second report (default 10:00 PM) — night report
cron.schedule(
  cron2,
  () => {
    console.log(`[scheduler] Triggering ${report2Time} report`);
    sendScheduledReport(report2Time).catch(console.error);
  },
  { timezone: tz }
);

console.log(`[scheduler] Cron jobs scheduled (TZ: ${tz})`);
console.log(`[scheduler] Reports will auto-send at ${report1Time} and ${report2Time}`);

module.exports = { sendScheduledReport };
