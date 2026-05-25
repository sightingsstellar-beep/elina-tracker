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
db.getSettings = async () => ({
  child_name: 'Elina',
  daily_limit_ml: '1200',
  timezone: 'UTC',
});

const daySummary = {
  dayKey: '2026-05-25',
  totalIntake: 450,
  intakeByType: { water: 150, pediasure: 300 },
  inputs: [
    {
      id: 1,
      timestamp: Date.UTC(2026, 4, 25, 12, 30),
      day_key: '2026-05-25',
      entry_type: 'input',
      fluid_type: 'water',
      amount_ml: 150,
      subtype: null,
      notes: null,
    },
  ],
  outputs: [
    {
      id: 2,
      timestamp: Date.UTC(2026, 4, 25, 13, 45),
      day_key: '2026-05-25',
      entry_type: 'output',
      fluid_type: 'urine',
      amount_ml: 90,
      subtype: null,
      notes: null,
    },
  ],
  wellness: [
    {
      id: 3,
      timestamp: Date.UTC(2026, 4, 25, 21, 0),
      check_time: '5pm',
      appetite: 7,
      energy: 5,
      mood: 8,
      cyanosis: 2,
    },
  ],
  gags: [
    { id: 4, timestamp: Date.UTC(2026, 4, 25, 14, 15), day_key: '2026-05-25' },
  ],
  gagCount: 1,
};

db.getDaySummary = async (dayKey) => ({ ...daySummary, dayKey });
db.getDaySummaries = async (dayKeys) => dayKeys.map((dayKey) => ({ ...daySummary, dayKey }));
db.getWeightForDate = async (dayKey) =>
  dayKey === '2026-05-25'
    ? { date: dayKey, weight_kg: 19.2, notes: 'morning' }
    : null;
db.getWeightHistory = async (days) => [
  { date: '2026-05-25', weight_kg: 19.2, notes: 'morning' },
  { date: '2026-05-24', weight_kg: 19.1, notes: null },
].slice(0, days);
db.getWeightHistoryUpTo = async (throughDate, days) => [
  { date: throughDate, weight_kg: 19.2, notes: 'morning' },
].slice(0, days);
db.logEntry = async (entry) => ({ id: 10, ...entry });
db.upsertWellness = async (entry) => ({ id: 11, ...entry });
db.logGag = async (count, timestamp, dayKey) =>
  Array.from({ length: count }, (_, index) => ({ id: 20 + index, timestamp, day_key: dayKey }));
db.deleteLog = async (id) => ({ changes: id === 10 ? 1 : 0 });
db.deleteGag = async (id) => ({ changes: id === 20 ? 1 : 0 });
db.deleteWellness = async (dayKey, checkTime) => ({
  changes: dayKey === '2026-05-25' && checkTime === '5pm' ? 1 : 0,
});

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

parser.parseMessage = async () => ({
  actions: [
    { type: 'input', fluid_type: 'water', amount_ml: 125 },
  ],
  unparseable: false,
});

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
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

function apiHeaders() {
  return { 'x-api-key': 'test-api-key' };
}

function assertObject(value, label) {
  assert.equal(typeof value, 'object', `${label} should be an object`);
  assert.notEqual(value, null, `${label} should not be null`);
  assert.equal(Array.isArray(value), false, `${label} should not be an array`);
}

function assertKeys(value, keys, label) {
  assertObject(value, label);
  for (const key of keys) {
    assert.ok(Object.hasOwn(value, key), `${label} should include ${key}`);
  }
}

function assertNumber(value, label) {
  assert.equal(typeof value, 'number', `${label} should be a number`);
}

function assertString(value, label) {
  assert.equal(typeof value, 'string', `${label} should be a string`);
}

function assertNullableString(value, label) {
  assert.ok(value === null || typeof value === 'string', `${label} should be null or a string`);
}

test('GET /api/version exposes the public release contract', async () => {
  const response = await request('/api/version');

  assert.equal(response.status, 200);
  assertKeys(response.body, ['name', 'version', 'release', 'environment', 'commit', 'builtAt', 'components'], 'version');
  assertString(response.body.name, 'version.name');
  assertString(response.body.version, 'version.version');
  assertNullableString(response.body.release, 'version.release');
  assertNullableString(response.body.commit, 'version.commit');
  assertNullableString(response.body.builtAt, 'version.builtAt');
  assertKeys(response.body.components, ['webApp', 'alexaSkill'], 'version.components');
  assertKeys(response.body.components.webApp, ['name', 'version'], 'version.components.webApp');
  assertKeys(response.body.components.alexaSkill, ['name', 'invocationName', 'version'], 'version.components.alexaSkill');
});

test('protected JSON routes share the unauthenticated error contract', async () => {
  const response = await request('/api/day?date=2026-05-25');

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { ok: false, error: 'Unauthorized', code: 'unauthorized' });
});

test('GET /api/day exposes the day chart contract', async () => {
  const response = await request('/api/day?date=2026-05-25', { headers: apiHeaders() });

  assert.equal(response.status, 200);
  assertKeys(response.body, [
    'ok',
    'dayKey',
    'todayDayKey',
    'limit_ml',
    'totalIntake',
    'percent',
    'intakeByType',
    'inputs',
    'outputs',
    'wellness',
    'gags',
    'gagCount',
  ], 'day');
  assert.equal(response.body.ok, true);
  assertString(response.body.dayKey, 'day.dayKey');
  assertNumber(response.body.limit_ml, 'day.limit_ml');
  assertNumber(response.body.totalIntake, 'day.totalIntake');
  assertNumber(response.body.percent, 'day.percent');
  assertObject(response.body.intakeByType, 'day.intakeByType');
  assert.ok(Array.isArray(response.body.inputs), 'day.inputs should be an array');
  assert.ok(Array.isArray(response.body.outputs), 'day.outputs should be an array');
  assert.ok(Array.isArray(response.body.wellness), 'day.wellness should be an array');
  assert.ok(Array.isArray(response.body.gags), 'day.gags should be an array');
  assertKeys(response.body.inputs[0], [
    'id',
    'timestamp',
    'entry_type',
    'fluid_type',
    'amount_ml',
    'time',
    'time24',
    'fluid_type_label',
  ], 'day.inputs[0]');
  assertKeys(response.body.outputs[0], [
    'id',
    'timestamp',
    'entry_type',
    'fluid_type',
    'amount_ml',
    'time',
    'time24',
    'fluid_type_label',
  ], 'day.outputs[0]');
  assertKeys(response.body.gags[0], ['id', 'timestamp', 'day_key', 'time', 'time24'], 'day.gags[0]');
});

test('GET /api/history exposes the chart history contract', async () => {
  const response = await request('/api/history?days=2', { headers: apiHeaders() });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'days'], 'history');
  assert.equal(response.body.ok, true);
  assert.ok(Array.isArray(response.body.days), 'history.days should be an array');
  assert.equal(response.body.days.length, 2);

  const day = response.body.days[0];
  assertKeys(day, [
    'dayKey',
    'label',
    'isToday',
    'intake',
    'inputs',
    'outputs',
    'gags',
    'gagCount',
    'wellness',
  ], 'history.days[0]');
  assertString(day.dayKey, 'history.days[0].dayKey');
  assertString(day.label, 'history.days[0].label');
  assert.equal(typeof day.isToday, 'boolean', 'history.days[0].isToday should be a boolean');
  assertKeys(day.intake, ['total_ml', 'limit_ml', 'percent', 'byType'], 'history.days[0].intake');
  assertKeys(day.wellness, ['afternoon', 'evening'], 'history.days[0].wellness');
  assertKeys(day.inputs[0], ['id', 'time', 'time24', 'fluid_type', 'fluid_type_label', 'amount_ml'], 'history.days[0].inputs[0]');
  assertKeys(day.outputs[0], ['id', 'fluid_type', 'subtype', 'amount_ml', 'time', 'time24'], 'history.days[0].outputs[0]');
});

test('GET /api/settings exposes the flat settings contract', async () => {
  const response = await request('/api/settings', { headers: apiHeaders() });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'child_name', 'daily_limit_ml', 'timezone'], 'settings');
  assert.equal(response.body.ok, true);
  assertString(response.body.child_name, 'settings.child_name');
  assertString(response.body.daily_limit_ml, 'settings.daily_limit_ml');
  assertString(response.body.timezone, 'settings.timezone');
});

test('GET /api/weight/day exposes the requested-day weight contract', async () => {
  const response = await request('/api/weight/day?date=2026-05-25', { headers: apiHeaders() });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'date', 'weight'], 'weightToday');
  assert.equal(response.body.ok, true);
  assertString(response.body.date, 'weightToday.date');
  assertKeys(response.body.weight, ['date', 'weight_kg', 'notes'], 'weightToday.weight');
  assertNumber(response.body.weight.weight_kg, 'weightToday.weight.weight_kg');
});

test('GET /api/weight/today remains a compatibility alias', async () => {
  const response = await request('/api/weight/today?date=2026-05-25', { headers: apiHeaders() });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'date', 'weight'], 'weightTodayAlias');
  assert.equal(response.body.ok, true);
  assert.equal(response.body.date, '2026-05-25');
});

test('GET /api/weight/history exposes the weight history contract', async () => {
  const response = await request('/api/weight/history?days=2', { headers: apiHeaders() });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'entries'], 'weightHistory');
  assert.equal(response.body.ok, true);
  assert.ok(Array.isArray(response.body.entries), 'weightHistory.entries should be an array');
  assert.equal(response.body.entries.length, 2);
  assertKeys(response.body.entries[0], ['date', 'weight_kg', 'notes'], 'weightHistory.entries[0]');
  assertString(response.body.entries[0].date, 'weightHistory.entries[0].date');
  assertNumber(response.body.entries[0].weight_kg, 'weightHistory.entries[0].weight_kg');
});

test('POST /api/chat exposes the assistant logging contract', async () => {
  const response = await request('/api/chat', {
    method: 'POST',
    headers: apiHeaders(),
    body: { text: '125ml water' },
  });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'message', 'entries', 'dayKey'], 'chat');
  assert.equal(response.body.ok, true);
  assertString(response.body.message, 'chat.message');
  assertString(response.body.dayKey, 'chat.dayKey');
  assert.ok(Array.isArray(response.body.entries), 'chat.entries should be an array');
  assertKeys(response.body.entries[0], ['kind', 'type', 'fluid_type', 'amount_ml', 'id'], 'chat.entries[0]');
  assert.equal(response.body.entries[0].kind, 'input');
  assertNumber(response.body.entries[0].amount_ml, 'chat.entries[0].amount_ml');
});

test('POST /api/log exposes the fluid create contract', async () => {
  const response = await request('/api/log', {
    method: 'POST',
    headers: apiHeaders(),
    body: {
      date: '2026-05-25',
      time: '12:45',
      entry_type: 'input',
      fluid_type: 'water',
      amount_ml: 120,
    },
  });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'results', 'totalIntake'], 'logCreate');
  assert.equal(response.body.ok, true);
  assert.ok(Array.isArray(response.body.results), 'logCreate.results should be an array');
  assertNumber(response.body.totalIntake, 'logCreate.totalIntake');
  assertKeys(response.body.results[0], ['kind', 'data'], 'logCreate.results[0]');
  assert.equal(response.body.results[0].kind, 'fluid');
  assertKeys(response.body.results[0].data, [
    'id',
    'timestamp',
    'day_key',
    'entry_type',
    'fluid_type',
    'amount_ml',
    'subtype',
    'notes',
    'source',
  ], 'logCreate.results[0].data');
});

test('POST /api/log exposes the wellness create contract', async () => {
  const response = await request('/api/log', {
    method: 'POST',
    headers: apiHeaders(),
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
  assertKeys(response.body, ['ok', 'results', 'totalIntake'], 'wellnessCreate');
  assert.equal(response.body.ok, true);
  assertKeys(response.body.results[0], ['kind', 'data'], 'wellnessCreate.results[0]');
  assert.equal(response.body.results[0].kind, 'wellness');
  assertKeys(response.body.results[0].data, [
    'id',
    'day_key',
    'check_time',
    'appetite',
    'energy',
    'mood',
    'cyanosis',
    'source',
  ], 'wellnessCreate.results[0].data');
});

test('POST /api/log exposes the gag create contract', async () => {
  const response = await request('/api/log', {
    method: 'POST',
    headers: apiHeaders(),
    body: {
      type: 'gag',
      date: '2026-05-25',
      time: '14:30',
      count: 2,
    },
  });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'results', 'totalIntake'], 'gagCreate');
  assert.equal(response.body.ok, true);
  assertKeys(response.body.results[0], ['kind', 'count', 'data'], 'gagCreate.results[0]');
  assert.equal(response.body.results[0].kind, 'gag');
  assertNumber(response.body.results[0].count, 'gagCreate.results[0].count');
  assert.ok(Array.isArray(response.body.results[0].data), 'gagCreate.results[0].data should be an array');
  assertKeys(response.body.results[0].data[0], ['id', 'timestamp', 'day_key'], 'gagCreate.results[0].data[0]');
});

test('POST /api/log exposes the validation error contract', async () => {
  const response = await request('/api/log', {
    method: 'POST',
    headers: apiHeaders(),
    body: {
      date: '2026-05-25',
      entry_type: 'input',
      fluid_type: 'water',
    },
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    ok: false,
    error: 'Amount is required for fluid intake and fluid output entries',
    code: 'missing_amount',
  });
});

test('POST /api/log exposes date validation error codes', async () => {
  const response = await request('/api/log', {
    method: 'POST',
    headers: apiHeaders(),
    body: {
      date: '2026/05/25',
      entry_type: 'input',
      fluid_type: 'water',
      amount_ml: 120,
    },
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    ok: false,
    error: 'Invalid date format. Use YYYY-MM-DD.',
    code: 'invalid_date_format',
  });
});

test('GET /api/weight/day exposes relative-date validation error codes', async () => {
  const response = await request('/api/weight/day?relative=tomorrow', { headers: apiHeaders() });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    ok: false,
    error: 'Invalid relative date. Use today or yesterday.',
    code: 'invalid_relative_date',
  });
});

test('POST /api/chat exposes missing-text validation error codes', async () => {
  const response = await request('/api/chat', {
    method: 'POST',
    headers: apiHeaders(),
    body: { text: '' },
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    ok: false,
    error: 'Missing or empty text',
    code: 'missing_text',
  });
});

test('PATCH /api/log/:id exposes the fluid edit contract', async () => {
  updatedLog = null;
  const response = await request('/api/log/10', {
    method: 'PATCH',
    headers: apiHeaders(),
    body: {
      date: '2026-05-25',
      time: '13:15',
      amount_ml: 180,
    },
  });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'entry'], 'logEdit');
  assert.equal(response.body.ok, true);
  assertKeys(response.body.entry, [
    'id',
    'timestamp',
    'day_key',
    'entry_type',
    'fluid_type',
    'amount_ml',
    'subtype',
    'notes',
    'time',
    'time24',
    'fluid_type_label',
  ], 'logEdit.entry');
  assert.equal(response.body.entry.id, 10);
  assert.equal(response.body.entry.amount_ml, 180);
});

test('DELETE /api/log/:id exposes the fluid delete contract', async () => {
  const response = await request('/api/log/10', {
    method: 'DELETE',
    headers: apiHeaders(),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, deleted: 10 });
});

test('PATCH /api/gag/:id exposes the gag edit contract', async () => {
  updatedGag = null;
  const response = await request('/api/gag/20', {
    method: 'PATCH',
    headers: apiHeaders(),
    body: {
      date: '2026-05-25',
      time: '15:30',
    },
  });

  assert.equal(response.status, 200);
  assertKeys(response.body, ['ok', 'entry'], 'gagEdit');
  assert.equal(response.body.ok, true);
  assertKeys(response.body.entry, ['id', 'timestamp', 'day_key', 'time', 'time24'], 'gagEdit.entry');
  assert.equal(response.body.entry.id, 20);
  assert.equal(response.body.entry.time24, '15:30');
});

test('DELETE /api/gag/:id exposes the gag delete contract', async () => {
  const response = await request('/api/gag/20', {
    method: 'DELETE',
    headers: apiHeaders(),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, deleted: 20 });
});

test('DELETE /api/wellness exposes the wellness delete contract', async () => {
  const response = await request('/api/wellness?date=2026-05-25&check_time=5pm', {
    method: 'DELETE',
    headers: apiHeaders(),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    ok: true,
    deleted: { date: '2026-05-25', check_time: '5pm' },
  });
});
