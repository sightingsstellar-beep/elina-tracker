'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('server module can be imported without starting runtime side effects', () => {
  const child = spawnSync(process.execPath, [
    '-e',
    [
      "process.env.DATABASE_URL='postgres://user:pass@127.0.0.1:1/test';",
      "const server = require('./server');",
      "console.log(typeof server.app, typeof server.start);",
    ].join(''),
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 2000,
  });

  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), 'function function');
});
