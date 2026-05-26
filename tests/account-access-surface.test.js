'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('account shell owns care team access without a separate caregivers surface', () => {
  const shell = read('public/shell.html');
  const router = read('public/shell-router.js');
  const server = read('server.js');
  const surfaceMap = read('surface.map.json');

  assert.match(shell, /settings-template-account/);
  assert.match(shell, /Care Team Access/);
  assert.match(shell, /account-menu-panel[\s\S]*href="\/account"/);
  assert.doesNotMatch(shell, /top-nav-item[^>]*data-route="account"/);
  assert.doesNotMatch(shell, /settings-template-caregivers/);
  assert.doesNotMatch(shell, /href="\/caregivers"/);
  assert.doesNotMatch(router, /\/caregivers/);
  assert.doesNotMatch(server, /'\/caregivers'/);
  assert.doesNotMatch(surfaceMap, /public\/caregivers\.html/);
  assert.equal(fs.existsSync(path.join(root, 'public/caregivers.html')), false);
});
