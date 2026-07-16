# Validation

## Proof Strategy

The fix is complete when deterministic request-shape tests prove that
Flash-Lite receives 1K for edit and upscale, unsupported models omit
`imageSize`, and the selector prevents unsupported user choices.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Registry reports Flash-Lite as 1K-only. |
| Integration | Gemini edit/upscale request objects clamp Flash-Lite to 1K and omit unsupported fields. |
| Component | Resolution selector resets stale 2K state and hides 2K/4K for Flash-Lite. |
| E2E | Three subject images plus one outfit through the live gateway. |
| Platform | Typecheck, lint, full Vitest suite, production build. |

## Fixtures

- Deterministic base64 image fixtures in `__tests__/services/gemini/image.test.ts`.
- Live smoke fixtures: `docs/image-test/s90.jpg` for the subject and
  `docs/image-test/V66.jpg` for the outfit.

## Commands

```text
npm run test -- __tests__/services/gemini/image.test.ts __tests__/config/modelSelectionRules.test.ts __tests__/components/ResolutionSelector.test.tsx
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

## Acceptance Evidence

- Red proof: Flash-Lite edit and upscale tests initially received `2K` instead
  of the expected `1K`.
- Focused proof after review: 57 tests passed across the Gemini request service,
  service facade, model registry, resolution selector, upscale prompt builder,
  and UI boundary suites. The request tests cover clamping, omission, and
  preservation of supported resolutions for both edit and upscale paths.
- Platform proof: `npx tsc --noEmit`, `npm run lint`, `npm run build`, and
  `git diff --check` passed.
- Full-suite proof: `npm run test` reports 751 passed across 72 test files.
  The prompt-builder expectations now cover the strengthened face-preservation
  and subject-image lighting wording included in this branch.
- Documentation check: `scripts/check-harness-docs-sync` remains red because
   the repository's `docs/TEST_MATRIX.md` and `docs/HARNESS_BACKLOG.md` snapshots
   already diverge broadly from `harness.db`. On Windows, the repo-local
   `scripts/bin/harness-cli.exe` was used directly for Harness evidence; the
   POSIX wrapper's executable-bit issue remains outside this application fix.
- Live gateway proof passed with the ignored local `.env` gateway configuration:
  authenticated model discovery returned `200` with 13 models, text
  `generateContent` returned `200` with `ok`, and three Flash-Lite Virtual
  Try-On requests each returned `200` with a non-empty JPEG image. The first
  concurrent attempt hit two local connection timeouts, so those two jobs were
  retried sequentially; all three independent image jobs completed. Output
  samples are retained under the ignored
  `scripts/e2e-live/output/vto-flash-lite-batch/` directory.
- Authentication diagnosis: the earlier failed smoke loaded a 60-character
  terminal value, while the valid `.env` gateway key is 36 characters. The
  earlier `AUTH_INVALID` result therefore tested a different credential, not
  the configured gateway key.
