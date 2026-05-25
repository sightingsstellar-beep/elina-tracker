# Glide Bedside Release v1.2.4

Date: 2026-05-25

## Summary

This patch release collects the persistent app shell, navigation polish, layout stabilization, and auth/session fixes shipped during the Glide Bedside app-readiness pass.

## Changes

- Added a persistent app shell with client-side routing for the main chart, trends, chat, app settings, caregiver profile, patient profile, and caregiver access views.
- Moved profile, caregiver, patient, and settings navigation into the top menu while keeping Day, Trends, and Chat as Chart subsections.
- Refined desktop and mobile menu styling, including icon labels, cleaner desktop text navigation, and profile-scoped caregiver actions.
- Stabilized desktop chart layout with explicit columns and responsive placement for Gag Episodes under the shorter chart log column.
- Normalized desktop content width across Chart, Trends, Chat, and Settings.
- Added a two-column desktop App Settings layout while preserving the mobile single-column layout.
- Fixed the Clerk logout/login loop that could block a second login until cache or the incognito session was cleared.
- Hardened chart day navigation so stale background refreshes cannot overwrite a newer day-selector tap.

## Verification

- `npm test`
- `node --check public/app.js`
- `node --check public/settings.js`
- `node --check public/shell-router.js`
- `git diff --check`
- Production `/api/version` after deployment should report `version: 1.2.4`, `release: v1.2.4`, and the deployed release commit.

