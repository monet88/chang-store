---
phase: 1
title: "Upgrade Vulnerable Dependencies"
status: completed
priority: P1
effort: "2-4h"
dependencies: []
---

# Phase 1: Upgrade Vulnerable Dependencies

## Context Links

- Source report: `vbsec-reports/scan-2026-05-22-113905.md`
- Related files: `package.json`, `package-lock.json`
- Findings: high #1, high #2, medium #4, medium #5, medium #6

## Overview

Upgrade or override vulnerable dependency trees reported by vbsec and `npm audit`. This phase unblocks later security work by stabilizing the package tree first.

## Key Insights

- `@google/genai` currently appears as `^1.38.0` in `package.json`, while the lockfile resolves a newer tree that includes `protobufjs` advisories.
- `vite@^6.4.1` is reported high risk because dev server advisories can expose arbitrary files under unsafe host settings.
- `postcss`, `@protobufjs/utf8`, and `brace-expansion` findings are best handled through direct upgrades and lockfile regeneration before considering overrides.

## Requirements

- Functional: preserve existing React/Vite build, Gemini service imports, tests, and dev workflow.
- Non-functional: no unresolved high or medium audit findings for the reported dependency tree unless explicitly documented as accepted risk.

## Architecture

Dependency remediation should not change application architecture. Prefer semver-compatible upgrades first. Use `overrides` only when upstream packages have not released compatible patched dependency ranges and compatibility is verified by tests.

## Related Code Files

- Modify: `package.json`
- Modify: `package-lock.json`
- Do not modify application source unless a dependency upgrade requires a compile fix.

## Implementation Steps

1. Run `npm audit --json` to confirm current advisory IDs and patched ranges.
2. Check latest compatible versions of `@google/genai`, `vite`, `postcss`, and affected transitive packages.
3. Update direct dependencies first: `@google/genai`, `vite`, `postcss`, and any related Vite plugin constraints if needed.
4. Regenerate `package-lock.json` with `npm install`.
5. If transitive advisories remain, add the smallest compatible `overrides` block, document advisory IDs, patched ranges, and override rationale, then rerun `npm install`.
6. Run `npm audit`, `npx tsc --noEmit`, `npm run lint`, `npm run test`, and `npm run build`.
7. Manually smoke-test at least one Gemini-backed image flow because SDK behavior is the highest-risk upgrade surface.

## Todo List

- [ ] Confirm advisory IDs and patched versions.
- [ ] Upgrade direct dependencies.
- [ ] Regenerate lockfile.
- [ ] Add overrides only if required, with advisory IDs, patched ranges, and rationale.
- [ ] Run quality gates.
- [ ] Smoke-test Gemini integration.

## Success Criteria

- [ ] `npm audit` no longer reports the vbsec-listed high/medium dependency findings, or accepted-risk notes exist with advisory IDs, patched ranges, and override rationale.
- [ ] Build, lint, type-check, and tests pass.
- [ ] Gemini SDK usage still compiles and works through existing service facade.

## Risk Assessment

Risk is medium. Gemini SDK and Vite upgrades can introduce API or build behavior changes. Mitigate by changing dependency versions in one focused commit, running full gates, and keeping application code changes minimal.

## Security Considerations

Do not treat dependency upgrades as sufficient for the Gemini API key exposure. That is handled in Phase 5 because the key exposure is an architectural deployment issue, not only a package issue.

## Next Steps

Proceed to Phase 2 for Vite dev server defaults and Phase 3/4 for app-level security bugs after the package tree is stable.
