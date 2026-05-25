'use strict';

const { formatFluidType } = require('./care-labels');

function formatTimestamp(tsMs, timezone) {
  return new Date(tsMs).toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTimeInput(tsMs, timezone) {
  return new Date(tsMs).toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function dayLabel(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day, 12, 0, 0);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function presentInput(entry, timezone) {
  return {
    ...entry,
    time: formatTimestamp(entry.timestamp, timezone),
    time24: formatTimeInput(entry.timestamp, timezone),
    fluid_type_label: formatFluidType(entry.fluid_type),
  };
}

function presentOutput(entry, timezone) {
  return {
    ...entry,
    time: formatTimestamp(entry.timestamp, timezone),
    time24: formatTimeInput(entry.timestamp, timezone),
    fluid_type_label: formatFluidType(entry.fluid_type),
  };
}

function presentGag(entry, timezone) {
  return {
    ...entry,
    time: formatTimestamp(entry.timestamp, timezone),
    time24: formatTimeInput(entry.timestamp, timezone),
  };
}

function presentDay(summary, { limitMl, todayDayKey, timezone }) {
  return {
    ok: true,
    dayKey: summary.dayKey,
    todayDayKey,
    limit_ml: limitMl,
    totalIntake: summary.totalIntake,
    percent: Math.round((summary.totalIntake / limitMl) * 100),
    intakeByType: summary.intakeByType,
    inputs: summary.inputs.map((entry) => presentInput(entry, timezone)),
    outputs: summary.outputs.map((entry) => presentOutput(entry, timezone)),
    wellness: summary.wellness,
    gags: summary.gags.map((entry) => presentGag(entry, timezone)),
    gagCount: summary.gagCount,
  };
}

function pickWellness(row) {
  return row ? {
    check_time: row.check_time,
    appetite: row.appetite,
    energy: row.energy,
    mood: row.mood,
    cyanosis: row.cyanosis,
  } : null;
}

function presentHistoryDay(summary, { limitMl, todayDayKey, timezone }) {
  const totalMl = summary.totalIntake;
  const afternoonRow = summary.wellness.find((w) => w.check_time === '5pm') || null;
  const eveningRow = summary.wellness.find((w) => w.check_time === '10pm') || null;

  return {
    dayKey: summary.dayKey,
    label: dayLabel(summary.dayKey),
    isToday: summary.dayKey === todayDayKey,
    intake: {
      total_ml: totalMl,
      limit_ml: limitMl,
      percent: Math.round((totalMl / limitMl) * 100),
      byType: summary.intakeByType,
    },
    inputs: summary.inputs.map((entry) => ({
      id: entry.id,
      time: formatTimestamp(entry.timestamp, timezone),
      time24: formatTimeInput(entry.timestamp, timezone),
      fluid_type: entry.fluid_type,
      fluid_type_label: formatFluidType(entry.fluid_type),
      amount_ml: entry.amount_ml,
    })),
    outputs: summary.outputs.map((entry) => ({
      id: entry.id,
      fluid_type: entry.fluid_type,
      subtype: entry.subtype ?? null,
      amount_ml: entry.amount_ml,
      time: formatTimestamp(entry.timestamp, timezone),
      time24: formatTimeInput(entry.timestamp, timezone),
    })),
    gags: summary.gags.map((entry) => ({
      id: entry.id,
      time: formatTimestamp(entry.timestamp, timezone),
      time24: formatTimeInput(entry.timestamp, timezone),
    })),
    gagCount: summary.gagCount,
    wellness: {
      afternoon: pickWellness(afternoonRow),
      evening: pickWellness(eveningRow),
    },
  };
}

function presentHistory(summaries, options) {
  return {
    ok: true,
    days: summaries.map((summary) => presentHistoryDay(summary, options)),
  };
}

module.exports = {
  presentDay,
  presentHistory,
  presentHistoryDay,
};
