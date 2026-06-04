---
phase: 5
title: "Admin Dashboard UI"
status: completed
priority: P2
effort: "1-1.5d"
dependencies: [4]
---

# Phase 5: Admin Dashboard UI

## Overview

Add a compact gateway-served admin dashboard for credential cards, detail/edit modal, model catalog, and pool health. The UI should be operational, not a marketing or end-user studio screen.

## Requirements

- Functional: login with admin token and call same-origin admin APIs using `Authorization: Bearer <token>`.
- Functional: upload/import service-account JSON, list credentials, enable/disable, delete, test, edit label/location/weight/model metadata.
- Functional: show supported model catalog for Gemini/OpenAI and per-credential model coverage.
- Functional: show store mode and mutation status; import/delete should be enabled only when API reports writable `file-store`.
- Non-functional: do not store raw service-account JSON in localStorage; after import, clear file input and in-memory payload.
- Non-functional: do not put the admin token in URL/query string or cookies.
- Non-functional: keep UI plain, dense, and predictable like the CLIProxyAPI screenshots, but branded only as gateway admin.

## Architecture

Serve the dashboard from the gateway itself instead of the main Vite SPA. This keeps the secret-management surface separate from the end-user fashion studio and avoids exposing admin code through the public app bundle.

**Delivery mechanism:** `admin-ui.ts` exports a function that returns a complete self-contained HTML string (inline CSS + vanilla JS). No separate `.html` file, no `express.static`, no build step. `admin-routes.ts` calls this function and sends the result with `Content-Type: text/html`. All admin API calls from the UI use `fetch()` with `Authorization: Bearer <token>` against same-origin `/admin/api/*` endpoints.

Suggested files:

- `gateway/src/admin/admin-ui.ts` — exports function returning inline HTML/CSS/JS string.
- `gateway/src/admin/admin-routes.ts` — serves `GET /admin` and `/admin/api/*`.

Screens:

- Credentials: cards/table with status, project, email, location, weight, success/failure, health sparkline, actions.
- Detail/Edit: redacted metadata, enable toggle, label, location, weight, model allow/exclude.
- Models: provider tabs for Gemini/OpenAI backed by Phase 1 `modelCatalog`, enabled toggles, aliases/defaults.
- Security: admin route status, store mode, last reload, and warnings when file-store is not backed by a persistent Docker/VPS volume.

## Related Code Files

- Create: `gateway/src/admin/admin-ui.ts`
- Modify: `gateway/src/admin/admin-routes.ts`
- Create/modify: `gateway/test/admin-ui.test.ts`
- Modify: `docs/api/vertex-gateway-api-guide.md`

## Implementation Steps

1. Implement a single static admin shell with no build step.
2. Add token login stored in memory by default, with optional session storage only if explicitly chosen; never put the token in URLs/cookies and never store raw credentials.
3. Add every admin API `fetch(...)` with `Authorization: Bearer <token>` and `credentials: 'same-origin'` only for ordinary same-origin browser behavior, not cookie auth.
4. Implement credential list, import, edit, delete, test, and enable/disable actions.
5. Implement model catalog and per-provider allow/exclude controls.
6. Display reload status and mutation-disabled reasons returned by the admin API.
7. Add visual health indicators using API counters, not client-side guesses.
8. Add responsive checks for desktop and narrow widths; keep controls stable and text non-overlapping.

## Success Criteria

- [ ] Dashboard loads only when admin routes are enabled.
- [ ] Login failure and expired/invalid token states are visible and non-destructive.
- [ ] Browser requests use `Authorization: Bearer <token>` and never append token to URL.
- [ ] Credential list matches admin API redaction contract.
- [ ] Upload/import clears raw JSON from UI state after the request completes.
- [ ] Models modal/view supports Gemini/OpenAI catalog without pretending unsupported Google API surfaces exist.
- [ ] UI cannot submit import/delete/model edits when API reports read-only or mutations disabled. Cloud Run file-store mutation mode should not reach UI because startup validation rejects it.
- [ ] UI tests or Playwright smoke prove the first screen, modal, and model list render without layout overlap.

## Risk Assessment

Risk: mixing admin with the main SPA can expose admin assumptions to normal users.
Mitigation: serve a separate gateway admin page under `/admin`.

Risk: dashboard grows into a full provider-control panel.
Mitigation: keep only credentials, models, health, and security/store mode in MVP.
