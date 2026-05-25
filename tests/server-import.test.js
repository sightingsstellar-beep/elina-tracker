'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:1/test';

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

test('Clerk login type labels Google OAuth separately from email login', () => {
  const { inferClerkLoginType } = require('../server');

  assert.deepEqual(inferClerkLoginType({
    externalAccounts: [{ provider: 'oauth_google' }],
    emailAddresses: [{ verification: { strategy: 'from_oauth_google' } }],
  }), {
    loginType: 'Google',
    loginProvider: 'oauth_google',
  });

  assert.deepEqual(inferClerkLoginType({
    externalAccounts: [],
    emailAddresses: [{ verification: { strategy: 'email_code' } }],
  }), {
    loginType: 'Email',
    loginProvider: 'email',
  });
});
