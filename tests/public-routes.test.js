'use strict';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:1/test';

const assert = require('node:assert/strict');
const test = require('node:test');
const { app } = require('../server');

function listen() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => resolve(server));
    server.on('error', reject);
  });
}

async function request(path) {
  const server = await listen();
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    };
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
}

test('GET /health returns an operational JSON payload', async () => {
  const response = await request('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(typeof response.body.version, 'string');
});

test('GET /api/version is public and non-cacheable', async () => {
  const response = await request('/api/version');

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.version, 'string');
  assert.match(response.headers.get('cache-control') || '', /no-store/);
});
