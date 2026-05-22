---
phase: 2
title: "Harden Vite Dev Server Defaults"
status: completed
priority: P2
effort: "1h"
dependencies: []
---

# Phase 2: Harden Vite Dev Server Defaults

## Context Links

- Source report: `vbsec-reports/scan-2026-05-22-113905.md`
- Related file: `vite.config.ts`
- Findings: low #9, supporting mitigation for high #2

## Overview

Change Vite dev server defaults so local development binds to localhost unless the developer intentionally enables LAN access. This reduces exposure from Vite dev server advisories.

## Key Insights

- Current config binds `server.host` to `0.0.0.0` by default.
- This increases impact of Vite dev server path traversal or file-read advisories in untrusted networks.
- The project can keep LAN testing support through an explicit environment flag.

## Requirements

- Functional: `npm run dev` still starts on port 3000 for local browser testing.
- Non-functional: default dev server is not exposed on all interfaces.

## Architecture

Keep the change in `vite.config.ts`. Use environment-controlled behavior such as `VITE_DEV_HOST=0.0.0.0` or `VITE_ENABLE_LAN=true` only when explicitly configured. If Vite `allowedHosts` is used, keep the allowlist narrow and documented.

## Related Code Files

- Modify: `vite.config.ts`
- Optional modify: `README.md` or docs if LAN development instructions change.

## Implementation Steps

1. Replace default `host: '0.0.0.0'` with localhost-safe default.
2. Add explicit environment-gated LAN mode if current workflows need phone or cross-device testing.
3. Add `allowedHosts` only when the Vite version and project workflow require it.
4. Run `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
5. Start dev server locally and verify the app opens at `localhost:3000`.
6. If LAN mode is retained, test it with the explicit flag and document the command.

## Todo List

- [ ] Make localhost the default host.
- [ ] Add explicit LAN opt-in if needed.
- [ ] Validate dev startup.
- [ ] Document changed dev workflow if needed.

## Success Criteria

- [ ] Default dev server is localhost-only.
- [ ] Port 3000 remains unchanged.
- [ ] LAN exposure requires a deliberate environment flag.
- [ ] Build, lint, and type-check pass.

## Risk Assessment

Risk is low. Developers who relied on automatic LAN access need a new explicit flag. Mitigate by documenting the opt-in command.

## Security Considerations

This does not patch Vite itself. It reduces exposure blast radius and should be paired with Phase 1 dependency upgrade.

## Next Steps

Proceed to Phase 5 after Phase 1 if Vite config will also be changed for API key exposure removal.
