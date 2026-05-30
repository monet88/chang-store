---
phase: 5
title: "Tests Docs Validation"
status: pending
priority: P1
effort: "0.5d"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Tests Docs Validation

## Overview

Validate the three-studio split with unit/component/service tests, boundary checks, docs updates, and quality gates. Ensure existing Gemini pipeline remains unchanged while Grok and GPT Image behavior is independently verified.

## Requirements

- Functional: Tests cover studio switch, provider settings, provider feature workflows, provider services, retry utility, and response parser.
- Functional: Existing Gemini tests still pass without modification.
- Functional: Docs explain the three-studio architecture, provider-specific request differences, provider settings model, and high-risk story evidence.
- Functional: Harness matrix includes the high-risk story row before implementation begins.
- Non-functional: Run `npx tsc --noEmit`, `npm run lint`, and `npm run test` after all changes.

## Architecture

Testing layers:

```text
Component tests
   → StudioModeSwitch / ProviderSettingsPanel / ProviderResultsGrid
Hook tests
   → useGrokStudio / useGptImageStudio state, validation, workflow dispatch, AbortController cleanup
Service tests
   → Grok JSON contract (generate + edit with official image/images object shape)
   → GPT JSON + multipart contract with repeated image[] fields
   → ApiProviderContext provider settings (env defaults + localStorage override + base URL validation)
   → ProviderApiError thrown on non-2xx
Utility tests
   → withRetry (exponential backoff + jitter, AbortSignal cancellation, ProviderApiError evaluation)
   → openaiCompatibleResponse (b64_json extraction + error envelope detection)
   → validatePrompt (max length, control char stripping)
Boundary tests
   → Existing UI does not import provider services directly
   → Gemini modelRegistry does not include Grok/GPT models
   → Gemini prompt builders not referenced in provider code
```

## Related Code Files

- Modify/Add: `__tests__/components/studios/*`
- Modify/Add: `__tests__/hooks/useGrokStudio.test.ts`
- Modify/Add: `__tests__/hooks/useGptImageStudio.test.ts`
- Modify/Add: `__tests__/services/providers/grok/grokImageService.test.ts`
- Modify/Add: `__tests__/services/providers/gpt-image/gptImageService.test.ts`
- Modify/Add: `__tests__/contexts/ApiProviderContext.test.tsx`
- Modify/Add: `__tests__/config/providerRegistry.test.ts`
- Modify/Add: `__tests__/utils/provider-url-validation.test.ts`
- Modify: `__tests__/components/ui-boundary-imports.test.ts` if service-boundary rules need new allowed paths.
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/product/overview.md`
- Modify: `docs/deployment-guide.md`
- Modify/Add: `docs/api/README.md`
- Modify/Add: `docs/api/grok-image-api-guide.md`
- Modify/Add: `docs/api/gpt-image-2-api-guide.md`
- Modify: `docs/project-roadmap.md`
- Modify: `docs/system-architecture.md`
- Modify/Add: `docs/stories/epics/E01-provider-studios/US-001-three-provider-studios/*`

## Implementation Steps

1. Component tests: StudioModeSwitch renders three segments, mode selection calls handler, active mode highlighted.
2. Shared component tests: settings panel loads env defaults and accepts edits with localStorage persistence, results grid shows local images only.
3. Grok service tests:
   - JSON headers/body for generate and edit.
   - Single-image edit uses `image` object; multi-image edit uses `images` object array.
   - Max 3 source images validated before network call.
   - `n` validation (1–10).
   - `b64_json` response parsing or typed unsupported-response failure when only URLs are returned.
4. GPT Image service tests:
   - JSON generate body with official size/quality values.
   - Multipart edit body with repeated `image[]` fields and correct MIME types.
   - No manual `Content-Type` header for multipart.
   - Retry triggers on `auth_unavailable` and stops after bounded attempts.
5. Provider settings tests: `ApiProviderContext` env default resolution, runtime override, namespaced localStorage persistence, reset behavior, and base URL allowlist validation.
6. Regression tests: Gemini model registry untouched, Gemini prompt builders not imported in provider code, `vite.config.ts` `define` block includes all 5 env vars (`GEMINI_API_KEY` + 4 provider vars), misleading comment fixed.
7. Update architecture/product/deployment/API docs and `docs/CHANGELOG.md` after all implementation phases pass quality gates. Existing docs must stop claiming the app is Gemini-only once runtime provider code ships.
8. Update high-risk story validation evidence and Harness matrix row with implemented verification results.
9. Run quality gates: `npx tsc --noEmit`, `npm run lint`, `npm run test`.
10. Address failures without weakening assertions or silencing real issues.

## Success Criteria

- [ ] Component, hook, and service tests pass for all new studio code.
- [ ] Service tests verify provider-specific request contracts accurately.
- [ ] Regression tests confirm Gemini pipeline remains fully isolated.
- [ ] Docs reflect the three-studio architecture, provider contracts, and settings model.
- [ ] Harness matrix and story validation evidence are updated.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` passes or only reports accepted pre-existing warnings.
- [ ] `npm run test` passes with no regressions in existing test suite.

## Risk Assessment

- Risk: Tests overfit implementation details.
  - Mitigation: Assert public behavior, network contract, and visible state; avoid internal state names.
- Risk: Boundary tests need updates after new provider paths are created.
  - Mitigation: Explicitly distinguish shared UI imports from provider service imports.
- Risk: Docs drift from code.
  - Mitigation: Update docs only after implementation stabilizes and tests pass.

<!-- Updated: Validation Session 1 — Added vite.config.ts env var injection to regression test scope -->
<!-- Updated: Red Team Session — docs/project-changelog.md → docs/CHANGELOG.md, added AbortController/validatePrompt/ProviderApiError/backoff to test architecture -->
<!-- Updated: Session 3 — provider settings tests moved to ApiProviderContext; Grok/GPT contracts corrected; docs and Harness story scope expanded -->
