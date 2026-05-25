'use strict';

const realtime = require('../realtime');

function publishCareChange(scope = {}, detail = {}) {
  realtime.publishCareChange(scope, detail);
}

module.exports = { publishCareChange };
