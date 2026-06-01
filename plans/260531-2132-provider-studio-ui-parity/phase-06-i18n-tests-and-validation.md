---
phase: 6
title: "i18n Tests and Validation"
status: pending
priority: P2
effort: "1d"
dependencies: [2, 3, 4, 5]
---

# Phase 6: i18n Tests and Validation

## Overview

Add/expand i18n keys for all new UI (steps, source cards, wardrobe, lookbook output),
write tests for the new components/hooks, and run the full quality-gate suite. Update docs.

## Requirements

- Functional: every new user-facing string has EN + VI keys (no hardcoded strings).
- Non-functional: maintain test coverage; all gates green; docs reflect the new UI.

## Architecture

- i18n: add keys under the existing `studio.*` namespace in `src/locales/en.ts` (source of
  truth) and mirror in `vi.ts`. Cover: step eyebrow/titles, source-item card labels,
  add/remove buttons, wardrobe mode toggle + set/item labels, lookbook output stages
  (variations/close-up/refine history).
- Tests: unit-test the new hooks (`useProviderWardrobe`, `useProviderLookbookOutput`, the
  source-item alignment helpers in `useProviderStudioFields`); component-test the new
  presentational pieces (`ProviderSourceItemGrid`, `ProviderWardrobePanel`, step rendering).
- Boundary: re-run `ui-boundary-imports.test.ts` and `providerIsolation.test.ts`, and add hook-scoped boundary coverage that forbids service/config imports in shared `src/hooks/useProvider*.ts` helpers only.

## Related Code Files

- Modify: `src/locales/en.ts`, `src/locales/vi.ts`
- Create: tests under `__tests__/` mirroring new source files
- Modify: `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md` (note provider UI parity)
- Read: existing `__tests__/components/studios/*`, `__tests__/config/providerIsolation.test.ts`

## Implementation Steps

1. Sweep new components for any literal user-facing string; replace with `t(...)` keys.
2. Add EN keys, mirror VI; verify no missing-key fallbacks at runtime.
3. Write unit tests: source-item add/remove index alignment; wardrobe set/item CRUD +
   batch; lookbook version-history step back/forward.
4. Write component tests: source-item grid add/remove; wardrobe panel toggle; step labels
   per workflow.
5. Run checkpoint gates after Phase 4 (`npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`) if shipping Phases 1-4 before Lookbook rich output; rerun the same full gates after Phase 5 for full parity.
6. Update `docs/ARCHITECTURE.md` + `docs/CHANGELOG.md` with the shipped scope (checkpoint vs full parity).
7. Manual E2E smoke (Playwright or browser): one workflow per provider, verify stepped UI,
   source cards, wardrobe, lookbook output render and a generation succeeds (Grok via
   tunnel; GPT via localhost).

## Success Criteria

- [ ] No hardcoded user-facing strings; EN + VI parity for all new keys.
- [ ] New hooks/components covered by tests; suite green.
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean; `npm run build` succeeds.
- [ ] `ui-boundary-imports.test.ts` + `providerIsolation.test.ts` pass.
- [ ] Docs updated; CHANGELOG entry added.

## Risk Assessment

- Risk: missing VI mirrors. Mitigation: add EN+VI in the same edit; consider a key-parity check.
- Risk: flaky E2E from dev-server reloads. Mitigation: `vite.config.ts` watch-ignores already
  added for `.playwright-mcp`, `docs`, `.claude`, etc.; GPT uses localhost.
