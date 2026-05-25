'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { presentDay, presentHistory } = require('../services/day-presenter');

const timezone = 'UTC';
const summary = {
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

test('presentDay preserves the existing day API shape', () => {
  const payload = presentDay(summary, { limitMl: 1200, todayDayKey: '2026-05-25', timezone });

  assert.equal(payload.ok, true);
  assert.equal(payload.dayKey, '2026-05-25');
  assert.equal(payload.totalIntake, 450);
  assert.equal(payload.percent, 38);
  assert.equal(payload.inputs[0].fluid_type_label, 'Water');
  assert.equal(payload.inputs[0].time24, '12:30');
  assert.equal(payload.outputs[0].fluid_type_label, 'Urine');
  assert.equal(payload.gagCount, 1);
});

test('presentHistory shapes chart-ready history without route-local logic', () => {
  const payload = presentHistory([summary], { limitMl: 1200, todayDayKey: '2026-05-25', timezone });

  assert.equal(payload.ok, true);
  assert.equal(payload.days.length, 1);
  assert.equal(payload.days[0].isToday, true);
  assert.deepEqual(payload.days[0].intake.byType, { water: 150, pediasure: 300 });
  assert.equal(payload.days[0].wellness.afternoon.appetite, 7);
  assert.equal(payload.days[0].wellness.evening, null);
});
