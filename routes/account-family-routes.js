'use strict';

const express = require('express');

function createAccountFamilyRouter({
  accountPreferenceSubject,
  db,
  mailer,
  requestScope,
}) {
  const router = express.Router();

  router.get('/api/me', async (req, res) => {
    const scope = req.scope || null;
    res.json({
      ok: true,
      scope,
      permissions: {
        canInviteCaregivers: scope?.role === 'owner',
      },
    });
  });

  router.get('/api/account/preferences', async (req, res) => {
    try {
      const subject = accountPreferenceSubject(req);
      if (!subject) return res.json({ ok: true, accountScoped: false, preferences: {} });
      const preferences = await db.getAccountPreferences(subject);
      res.json({ ok: true, accountScoped: true, preferences });
    } catch (err) {
      console.error('[GET /api/account/preferences]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/account/preferences', async (req, res) => {
    try {
      const subject = accountPreferenceSubject(req);
      if (!subject) return res.status(400).json({ ok: false, error: 'Account-scoped preferences require an authenticated account.' });
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ ok: false, error: 'Invalid request body' });
      }
      const allowedKeys = new Set([
        'ui_palette',
        'caregiver_name',
        'caregiver_email',
        'caregiver_phone',
        'caregiver_relationship',
        'caregiver_notes',
      ]);
      if (body.ui_palette !== undefined) {
        const palette = ['calm', 'contrast', 'sage', 'lavender', 'sunrise', 'dark', 'midnight'].includes(body.ui_palette) ? body.ui_palette : 'calm';
        await db.setAccountPreference(subject, 'ui_palette', palette);
      }
      for (const [key, value] of Object.entries(body)) {
        if (key === 'ui_palette' || !allowedKeys.has(key) || value === undefined || value === null) continue;
        await db.setAccountPreference(subject, key, String(value).slice(0, 1000));
      }
      const preferences = await db.getAccountPreferences(subject);
      res.json({ ok: true, accountScoped: true, preferences });
    } catch (err) {
      console.error('[POST /api/account/preferences]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.get('/api/family/members', async (req, res) => {
    try {
      const scope = requestScope(req);
      if (!scope.familyId) return res.status(400).json({ ok: false, error: 'family_scope_required' });
      const members = await db.getFamilyAccessList(scope.familyId);
      res.json({
        ok: true,
        family: { id: scope.familyId, name: scope.familyName || null },
        currentUser: {
          role: scope.role || 'caregiver',
          email: scope.email || null,
          displayName: scope.displayName || null,
        },
        permissions: {
          canInviteCaregivers: scope.role === 'owner',
        },
        members,
      });
    } catch (err) {
      console.error('[GET /api/family/members]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post('/api/family/invitations', async (req, res) => {
    try {
      const scope = requestScope(req);
      if (scope.role !== 'owner') {
        return res.status(403).json({ ok: false, error: 'Only the family owner can invite caregivers.' });
      }
      const email = String(req.body.email || '').trim().toLowerCase();
      const role = ['caregiver', 'viewer'].includes(req.body.role) ? req.body.role : 'caregiver';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: 'Valid email is required.' });
      }
      const invite = await db.createFamilyInvitation({
        familyId: scope.familyId,
        email,
        role,
        invitedByClerkUserId: scope.clerkUserId,
      });
      let emailDelivery = { sent: false, reason: 'mail_not_configured' };
      try {
        emailDelivery = await mailer.sendCaregiverInviteEmail({
          to: email,
          familyName: scope.familyName,
          patientName: scope.patientName,
          inviterName: scope.displayName || scope.email,
          role,
        });
      } catch (emailErr) {
        console.error('[invite-email] Failed to send caregiver invite:', emailErr.message);
        emailDelivery = { sent: false, reason: 'mail_send_failed' };
      }
      res.json({
        ok: true,
        invitation: { id: invite.id, email: invite.email, role: invite.role, status: invite.status },
        email: emailDelivery,
      });
    } catch (err) {
      console.error('[POST /api/family/invitations]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createAccountFamilyRouter };
