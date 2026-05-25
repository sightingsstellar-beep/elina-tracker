'use strict';

process.env.API_KEY = 'test-api-key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:1/test';
process.env.DISPLAY_TOKEN = 'display-token';

const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../db');
const parser = require('../parser');

db.getDayKey = (date = new Date(Date.UTC(2026, 4, 25))) => date.toISOString().slice(0, 10);
db.getSetting = (key) => ({ timezone: 'UTC' }[key] || null);
db.getSettingForScope = async (key) => ({
  daily_limit_ml: '1200',
  timezone: 'UTC',
}[key] || null);
const settings = {
  child_name: 'Elina',
  daily_limit_ml: '1200',
  timezone: 'UTC',
};
db.getSettings = async () => ({ ...settings });
db.setSetting = async (key, value) => {
  settings[key] = String(value);
};

const daySummary = {
  dayKey: '2026-05-25',
  totalIntake: 450,
  intakeByType: { water: 150, pediasure: 300 },
  inputs: [
    { id: 1, timestamp: Date.UTC(2026, 4, 25, 12, 30), entry_type: 'input', fluid_type: 'water', amount_ml: 150 },
  ],
  outputs: [
    { id: 2, timestamp: Date.UTC(2026, 4, 25, 13, 45), entry_type: 'output', fluid_type: 'urine', amount_ml: 90 },
  ],
  wellness: [
    { id: 3, timestamp: Date.UTC(2026, 4, 25, 21, 0), check_time: '5pm', appetite: 7, energy: 5, mood: 8, cyanosis: 2 },
  ],
  gags: [
    { id: 4, timestamp: Date.UTC(2026, 4, 25, 14, 15), day_key: '2026-05-25' },
  ],
  gagCount: 1,
};

db.getDaySummary = async (dayKey) => ({ ...daySummary, dayKey });
db.getDaySummaries = async (dayKeys) => dayKeys.map((dayKey) => ({ ...daySummary, dayKey }));
db.logEntry = async (entry) => ({ id: 10, ...entry });
db.upsertWellness = async (entry) => ({ id: 11, ...entry });
db.logGag = async (count, timestamp, dayKey) =>
  Array.from({ length: count }, (_, index) => ({ id: 20 + index, timestamp, day_key: dayKey }));
db.deleteLog = async (id) => ({ changes: id === 10 ? 1 : 0 });
db.deleteGag = async (id) => ({ changes: id === 20 ? 1 : 0 });
db.deleteWellness = async (dayKey, checkTime) => ({
  changes: dayKey === '2026-05-25' && checkTime === '5pm' ? 1 : 0,
});
db.getWeightForDate = async (dayKey) =>
  dayKey === '2026-05-25'
    ? { date: dayKey, weight_kg: 19.2, notes: 'morning' }
    : null;
db.logWeight = async (dayKey, weightKg, notes) => ({ date: dayKey, weight_kg: weightKg, notes });
db.getWeightHistory = async (days) => [
  { date: '2026-05-25', weight_kg: 19.2 },
  { date: '2026-05-24', weight_kg: 19.1 },
].slice(0, days);
db.getWeightHistoryUpTo = async (throughDate, days) => [
  { date: throughDate, weight_kg: 19.2 },
].slice(0, days);
db.deleteWeight = async (dayKey) => ({ changes: dayKey === '2026-05-25' ? 1 : 0 });
db.getAccountPreferences = async () => ({});
db.getFamilyAccessList = async () => [];
db.exportAllData = async () => ({ settings: { child_name: 'Elina' }, logs: [] });

let updatedLog = null;
const existingLog = {
  id: 10,
  timestamp: Date.UTC(2026, 4, 25, 12, 30),
  day_key: '2026-05-25',
  entry_type: 'input',
  fluid_type: 'water',
  amount_ml: 150,
  subtype: null,
  notes: null,
};
db.getLogById = async (id) => {
  if (id !== 10) return null;
  return updatedLog || existingLog;
};
db.updateLog = async (entry) => {
  updatedLog = { ...existingLog, ...entry };
  return { changes: 1 };
};

let updatedGag = null;
const existingGag = {
  id: 20,
  timestamp: Date.UTC(2026, 4, 25, 14, 15),
  day_key: '2026-05-25',
};
db.getGagById = async (id) => {
  if (id !== 20) return null;
  return updatedGag || existingGag;
};
db.updateGag = async (entry) => {
  updatedGag = { ...existingGag, ...entry };
  return { changes: 1 };
};

parser.parseMessage = async (text) => {
  if (text === 'not understandable') {
    return { actions: [], unparseable: true, raw_message: text };
  }
  return {
    actions: [
      { type: 'input', fluid_type: 'water', amount_ml: 125 },
    ],
    unparseable: false,
    raw_message: text,
  };
};

const { app } = require('../server');

function listen() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => resolve(server));
    server.on('error', reject);
  });
}

async function request(path, { headers = {}, method = 'GET', body } = {}) {
  const server = await listen();
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json', ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    };
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
}

test('protected day route rejects unauthenticated API requests', async () => {
  const response = await request('/api/day?date=2026-05-25');

  assert.equal(response.status, 401);
  assert.equal(response.body.ok, false);
});

test('GET /api/day returns canonical day payload with API key auth', async () => {
  const response = await request('/api/day?date=2026-05-25', { headers: { 'x-api-key': 'test-api-key' } });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.dayKey, '2026-05-25');
  assert.equal(response.body.limit_ml, 1200);
  assert.equal(response.body.percent, 38);
  assert.equal(response.body.inputs[0].fluid_type_label, 'Water');
});

test('GET /api/history returns batched history payload with API key auth', async () => {
  const response = await request('/api/history?days=2', { headers: { 'x-api-key': 'test-api-key' } });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.days.length, 2);
  assert.equal(response.body.days[0].intake.percent, 38);
  assert.equal(response.body.days[0].wellness.afternoon.appetite, 7);
});

test('POST /api/log creates a fluid entry with API key auth', async () => {
  const response = await request('/api/log', {
    method: 'POST',
    headers: { 'x-api-key': 'test-api-key' },
    body: {
      date: '2026-05-25',
      time: '12:45',
      entry_type: 'input',
      fluid_type: 'water',
      amount_ml: 120,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.results[0].kind, 'fluid');
  assert.equal(response.body.results[0].data.fluid_type, 'water');
  assert.equal(response.body.totalIntake, 450);
});

test('POST /api/log creates a wellness entry with API key auth', async () => {
  const response = await request('/api/log', {
    method: 'POST',
    headers: { 'x-api-key': 'test-api-key' },
    body: {
      type: 'wellness',
      date: '2026-05-25',
      check_time: '5pm',
      appetite: 7,
      energy: 6,
      mood: 8,
      cyanosis: 1,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.results[0].kind, 'wellness');
  assert.equal(response.body.results[0].data.check_time, '5pm');
  assert.equal(response.body.results[0].data.appetite, 7);
});

test('POST /api/log creates gag entries with API key auth', async () => {
  const response = await request('/api/log', {
    method: 'POST',
    headers: { 'x-api-key': 'test-api-key' },
    body: {
      type: 'gag',
      date: '2026-05-25',
      time: '14:30',
      count: 2,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.results[0].kind, 'gag');
  assert.equal(response.body.results[0].count, 2);
  assert.equal(response.body.results[0].data.length, 2);
});

test('PATCH /api/log/:id updates a fluid entry with API key auth', async () => {
  updatedLog = null;
  const response = await request('/api/log/10', {
    method: 'PATCH',
    headers: { 'x-api-key': 'test-api-key' },
    body: {
      date: '2026-05-25',
      time: '13:15',
      amount_ml: 180,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.entry.id, 10);
  assert.equal(response.body.entry.amount_ml, 180);
  assert.equal(response.body.entry.fluid_type_label, 'Water');
});

test('DELETE /api/log/:id deletes a fluid entry with API key auth', async () => {
  const response = await request('/api/log/10', {
    method: 'DELETE',
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.deleted, 10);
});

test('PATCH /api/gag/:id updates a gag entry with API key auth', async () => {
  updatedGag = null;
  const response = await request('/api/gag/20', {
    method: 'PATCH',
    headers: { 'x-api-key': 'test-api-key' },
    body: {
      date: '2026-05-25',
      time: '15:30',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.entry.id, 20);
  assert.equal(response.body.entry.day_key, '2026-05-25');
  assert.equal(response.body.entry.time24, '15:30');
});

test('DELETE /api/gag/:id deletes a gag entry with API key auth', async () => {
  const response = await request('/api/gag/20', {
    method: 'DELETE',
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.deleted, 20);
});

test('DELETE /api/wellness deletes a wellness entry with API key auth', async () => {
  const response = await request('/api/wellness?date=2026-05-25&check_time=5pm', {
    method: 'DELETE',
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.deleted, { date: '2026-05-25', check_time: '5pm' });
});

test('POST /api/weight logs a weight entry with API key auth', async () => {
  const response = await request('/api/weight', {
    method: 'POST',
    headers: { 'x-api-key': 'test-api-key' },
    body: {
      date: '2026-05-25',
      weight_kg: 19.4,
      notes: 'after breakfast',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.date, '2026-05-25');
  assert.equal(response.body.weight_kg, 19.4);
  assert.equal(response.body.replaced, true);
});

test('GET /api/weight/today returns a requested weight entry with API key auth', async () => {
  const response = await request('/api/weight/today?date=2026-05-25', {
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.date, '2026-05-25');
  assert.equal(response.body.weight.weight_kg, 19.2);
});

test('GET /api/weight/history returns weight entries with API key auth', async () => {
  const response = await request('/api/weight/history?days=2', {
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.entries.length, 2);
  assert.equal(response.body.entries[0].date, '2026-05-25');
});

test('DELETE /api/weight/:date deletes a weight entry with API key auth', async () => {
  const response = await request('/api/weight/2026-05-25', {
    method: 'DELETE',
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.deleted, '2026-05-25');
});

test('GET /api/settings returns settings with API key auth', async () => {
  const response = await request('/api/settings', {
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.child_name, 'Elina');
  assert.equal(response.body.daily_limit_ml, '1200');
});

test('POST /api/settings updates settings with API key auth', async () => {
  const response = await request('/api/settings', {
    method: 'POST',
    headers: { 'x-api-key': 'test-api-key' },
    body: {
      child_name: 'Glide Kid',
      daily_limit_ml: 1300,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.child_name, 'Glide Kid');
  assert.equal(response.body.daily_limit_ml, '1300');
});

test('GET /api/me returns API-key scope status', async () => {
  const response = await request('/api/me', {
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.scope, null);
  assert.equal(response.body.permissions.canInviteCaregivers, false);
});

test('GET /api/account/preferences falls back when account scope is unavailable', async () => {
  const response = await request('/api/account/preferences', {
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.accountScoped, false);
  assert.deepEqual(response.body.preferences, {});
});

test('POST /api/account/preferences rejects accountless API-key requests', async () => {
  const response = await request('/api/account/preferences', {
    method: 'POST',
    headers: { 'x-api-key': 'test-api-key' },
    body: { ui_palette: 'sage' },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
});

test('GET /api/family/members requires family scope', async () => {
  const response = await request('/api/family/members', {
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, 'family_scope_required');
});

test('POST /api/family/invitations requires owner role', async () => {
  const response = await request('/api/family/invitations', {
    method: 'POST',
    headers: { 'x-api-key': 'test-api-key' },
    body: { email: 'caregiver@example.com', role: 'caregiver' },
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.ok, false);
});

test('POST /api/chat logs a parsed entry with API key auth', async () => {
  const response = await request('/api/chat', {
    method: 'POST',
    headers: { 'x-api-key': 'test-api-key' },
    body: { text: '125ml water' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.dayKey, '2026-05-25');
  assert.equal(response.body.entries[0].kind, 'input');
  assert.equal(response.body.entries[0].amount_ml, 125);
  assert.match(response.body.message, /Added: 125ml Water/);
  assert.match(response.body.message, /Fluid intake:/);
});

test('POST /api/chat returns guidance for unparseable text', async () => {
  const response = await request('/api/chat', {
    method: 'POST',
    headers: { 'x-api-key': 'test-api-key' },
    body: { text: 'not understandable' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.entries.length, 0);
});

test('GET /api/display-data returns kiosk data with display token', async () => {
  const response = await request('/api/display-data?token=display-token');

  assert.equal(response.status, 200);
  assert.equal(response.body.totalIntake, 450);
  assert.equal(response.body.dailyLimit, 1200);
  assert.equal(response.body.outputByType.urine.display, '90 ml');
  assert.equal(response.body.patientName, null);
});

test('GET /api/backup requires API key auth', async () => {
  const unauthorized = await request('/api/backup');
  assert.equal(unauthorized.status, 401);

  const response = await request('/api/backup', {
    headers: { 'x-api-key': 'test-api-key' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.settings.child_name, 'Elina');
  assert.deepEqual(response.body.logs, []);
});
