'use strict';

const db = require('../db');
const { formatFluidType, formatPoopSubtype } = require('./care-labels');

function getDailyLimit() {
  return parseInt(db.getSetting('daily_limit_ml'), 10) || 1200;
}

async function getDailyLimitForScope(scope = {}) {
  return parseInt(await db.getSettingForScope('daily_limit_ml', scope), 10) || 1200;
}

function getChildName() {
  return db.getSetting('child_name') || 'Elina';
}

async function getChildNameForScope(scope = {}) {
  return await db.getSettingForScope('child_name', scope) || 'Child';
}

function getTimezone() {
  return db.getSetting('timezone') || process.env.TZ || 'America/New_York';
}

async function getTimezoneForScope(scope = {}) {
  return await db.getSettingForScope('timezone', scope) || process.env.TZ || 'America/New_York';
}

function formatTimestamp(tsMs, timezone = getTimezone()) {
  return new Date(tsMs).toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTimeInput(tsMs, timezone = getTimezone()) {
  return new Date(tsMs).toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

module.exports = {
  getDailyLimit,
  getDailyLimitForScope,
  getChildName,
  getChildNameForScope,
  getTimezone,
  getTimezoneForScope,
  formatFluidType,
  formatPoopSubtype,
  formatTimestamp,
  formatTimeInput,
};
