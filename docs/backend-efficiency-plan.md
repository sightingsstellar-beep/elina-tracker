# Glide Bedside Backend Efficiency Plan

## Objective

Reduce backend coupling and avoid avoidable database work while keeping each step small enough to validate independently. The direction of travel is an App Store-publishable native app, so backend work should preserve stable API contracts, backend-owned care rules, and testable payload shaping.

## Milestones

1. Break server/bot/scheduler coupling.
   - Move shared reporting, formatting, and care-change publication out of `server.js`.
   - Validation: `npm test`; no `require('./server')` consumers remain outside the server entrypoint.
   - Status: applied locally.

2. Batch history summaries.
   - Replace per-day `/api/history` summary reads with a batched `db.getDaySummaries(dayKeys, scope)` helper.
   - Validation: `npm test`; static route inspection confirms `/api/history` calls the batched helper.
   - Status: applied locally.

3. Continue reducing `server.js` infrastructure responsibility.
   - Move isolated infrastructure pieces first, then route groups.
   - Validation: `npm test` after each extraction.
   - Status: `PostgresSessionStore` extraction applied locally.

4. Isolate API response presentation for native readiness.
   - Move day/history response shaping out of route handlers.
   - Add pure behavioral tests for payload shape.
   - Status: applied locally.

5. Make route-level tests possible.
   - Export the Express app and start function separately.
   - Keep listener, bot, scheduler, and DB readiness side effects behind explicit startup.
   - Add an import-side-effect test before route smoke tests.
   - Add public route smoke tests for `/health` and `/api/version`.
   - Add API-key protected smoke tests for `/api/day` and `/api/history` without a live database.
   - Status: applied locally.

6. Separate route modules.
   - Extract care-log routes, settings routes, account/family routes, then Alexa routes.
   - Keep middleware order explicit in the server bootstrap.
   - Validation: syntax gate plus smoke checks for `/health`, `/api/version`, `/api/day`, `/api/history`, `/api/settings`, and Alexa version intent where credentials are available.
   - Status: read-only care routes extracted locally for `/api/day`, `/api/today`, `/api/history`, and `/api/report`; care-log mutation routes extracted for `/api/log`, `/api/gag/:id`, and `/api/wellness`; weight routes extracted for create, today, history, and delete; settings routes extracted; account/family JSON routes extracted; chat route extracted; display and backup routes extracted after smoke coverage.

7. Move schema management toward migrations.
   - Keep runtime boot focused on readiness and default seeding.
   - Move `CREATE TABLE` / `ALTER TABLE` changes into explicit migrations.
   - Validation: local migration dry run or disposable database before production deploy.

## Notes

- The current `npm test` gate now covers core public routes, protected day/history reads, `/api/log` fluid create/update/delete mutations, `/api/log` wellness/gag creation, standalone gag edit/delete, wellness delete, weight create/today/history/delete, settings read/write, account/family API-key behavior, `/api/chat` success/unparseable paths, display kiosk data, and API-key backup. Add Alexa smoke coverage before moving that specialized adapter.
- Day/history presenter tests now cover the first API response-shaping extraction.
- SQLite references in user-facing docs are stale after the Postgres migration and should be cleaned up before the next public release.
