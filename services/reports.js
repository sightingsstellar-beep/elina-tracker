'use strict';

const db = require('../db');
const { formatFluidType } = require('./care-labels');
const {
  formatTimestamp,
  getChildNameForScope,
  getDailyLimitForScope,
  getTimezoneForScope,
} = require('./care-format');

async function buildReport(dayKey, scope = {}) {
  const summary = await db.getDaySummary(dayKey, scope);
  const tz = await getTimezoneForScope(scope);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });

  const limit = await getDailyLimitForScope(scope);
  const percent = Math.round((summary.totalIntake / limit) * 100);

  const childName = await getChildNameForScope(scope);
  let report = `📋 ${childName}'s Report — ${dateStr} ${timeStr}\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `\n🫧 FLUID INTAKE: ${summary.totalIntake}ml / ${limit}ml (${percent}%)\n`;

  if (Object.keys(summary.intakeByType).length > 0) {
    for (const [type, ml] of Object.entries(summary.intakeByType)) {
      report += `  ${formatFluidType(type)}: ${ml}ml\n`;
    }
  } else {
    report += `  No intake logged\n`;
  }

  report += `\n🚽 OUTPUTS:\n`;
  if (summary.outputs.length > 0) {
    for (const o of summary.outputs) {
      const time = formatTimestamp(o.timestamp, tz);
      const amount = o.amount_ml ? ` ${o.amount_ml}ml` : '';
      report += `  ${time} — ${formatFluidType(o.fluid_type)}${amount}\n`;
    }
  } else {
    report += `  No outputs logged\n`;
  }

  report += `\n🤢 Gag episodes: ${summary.gagCount}\n`;

  if (summary.wellness.length > 0) {
    const latest = summary.wellness[summary.wellness.length - 1];
    report += `\n🩺 WELLNESS (${latest.check_time} check):\n`;
    if (latest.appetite !== null) report += `  Appetite: ${latest.appetite}/10\n`;
    if (latest.energy !== null) report += `  Energy: ${latest.energy}/10\n`;
    if (latest.mood !== null) report += `  Mood: ${latest.mood}/10\n`;
    if (latest.cyanosis !== null) report += `  Cyanosis: ${latest.cyanosis}/10\n`;
  } else {
    report += `\n🩺 WELLNESS: No check logged yet\n`;
  }

  report += `━━━━━━━━━━━━━━━━━━━━━━━`;
  return report;
}

module.exports = { buildReport };
