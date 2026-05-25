'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const { createAccountFamilyRouter } = require('../routes/account-family-routes');

function createTestApp(scope) {
  const app = express();
  const invitations = [];
  app.use(express.json());
  app.use(createAccountFamilyRouter({
    accountPreferenceSubject: () => 'clerk:user_owner',
    db: {
      getAccountPreferences: async () => ({}),
      getFamilyAccessList: async () => [
        {
          status: 'active',
          role: 'owner',
          email: 'owner@example.com',
          display_name: 'Owner',
        },
      ],
      createFamilyInvitation: async (invite) => {
        const saved = { id: 'invite_1', status: 'pending', ...invite };
        invitations.push(saved);
        return saved;
      },
    },
    mailer: {
      sendCaregiverInviteEmail: async () => ({ sent: true }),
    },
    requestScope: () => scope,
  }));
  app.locals.invitations = invitations;
  return app;
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => resolve(server));
    server.on('error', reject);
  });
}

async function request(app, path, { method = 'GET', body } = {}) {
  const server = await listen(app);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test('family owner can list and invite care team members', async () => {
  const app = createTestApp({
    familyId: 'family_1',
    familyName: 'Touma Family',
    patientName: 'Elina',
    role: 'owner',
    email: 'owner@example.com',
    displayName: 'Owner',
    clerkUserId: 'user_owner',
  });

  const members = await request(app, '/api/family/members');
  assert.equal(members.status, 200);
  assert.equal(members.body.ok, true);
  assert.equal(members.body.permissions.canInviteCaregivers, true);
  assert.equal(members.body.members[0].email, 'owner@example.com');

  const invite = await request(app, '/api/family/invitations', {
    method: 'POST',
    body: { email: 'NewCaregiver@Example.com', role: 'viewer' },
  });
  assert.equal(invite.status, 200);
  assert.equal(invite.body.ok, true);
  assert.equal(invite.body.invitation.email, 'newcaregiver@example.com');
  assert.equal(invite.body.invitation.role, 'viewer');
  assert.deepEqual(invite.body.email, { sent: true });
  assert.equal(app.locals.invitations[0].familyId, 'family_1');
});
