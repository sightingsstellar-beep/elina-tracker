'use strict';

const express = require('express');
const path = require('path');

function createDisplayRouter({ db, getDailyLimit, publicDir }) {
  const router = express.Router();

  router.get('/display', (req, res) => {
    const displayToken = process.env.DISPLAY_TOKEN;
    if (!displayToken || req.query.token !== displayToken) {
      return res.status(401).send('Unauthorized');
    }
    res.sendFile(path.join(publicDir, 'display.html'));
  });

  router.get('/api/display-data', async (req, res) => {
    const displayToken = process.env.DISPLAY_TOKEN;
    if (!displayToken || req.query.token !== displayToken) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const summary = await db.getDaySummary(db.getDayKey());
    const limit = getDailyLimit();

    const outputByType = {};
    for (const l of summary.outputs) {
      if (!outputByType[l.fluid_type]) outputByType[l.fluid_type] = { ml: 0, count: 0 };
      outputByType[l.fluid_type].ml += (l.amount_ml || 0);
      outputByType[l.fluid_type].count += 1;
    }
    for (const [type, data] of Object.entries(outputByType)) {
      data.display = type === 'poop' ? `${data.count}×` : `${data.ml} ml`;
    }

    return res.json({
      totalIntake: summary.totalIntake,
      dailyLimit: limit,
      intakeByType: summary.intakeByType,
      outputByType,
      patientName: db.getSetting('child_name') || null,
    });
  });

  return router;
}

module.exports = { createDisplayRouter };
