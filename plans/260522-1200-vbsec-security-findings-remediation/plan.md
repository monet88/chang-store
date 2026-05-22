---
title: "VBSEC Security Findings Remediation"
status: completed
priority: P1
source: "vbsec-reports/scan-2026-05-22-113905.md"
created: 2026-05-22
blockedBy: []
blocks: []
---

# VBSEC Security Findings Remediation

## Overview

Remediate all findings from `vbsec-reports/scan-2026-05-22-113905.md` before production use. The scan conclusion is `ĐẠT CÓ CẢNH BÁO`: 0 critical, 3 high, 5 medium, 1 low.

## Scope

In scope:
- Dependency advisories in `package.json` and `package-lock.json`.
- Vite dev server exposure and client bundle environment injection.
- Upload validation gaps in image uploader components.
- Google Drive sync queue race condition.
- Security verification, docs updates, and regression tests.

Out of scope:
- Rebuilding the app as a full backend platform unless chosen for the Gemini proxy phase.
- Changing user-facing feature scope beyond validation and safe error handling.
- Deleting `vbsec-reports/` without explicit user approval.

## Findings Map

| ID | Severity | Finding | Primary files | Phase |
|---:|---|---|---|---|
| 1 | High | `@google/genai` pulls vulnerable `protobufjs` tree | `package.json`, `package-lock.json` | [Phase 1](phase-01-upgrade-vulnerable-dependencies.md) |
| 2 | High | `vite@^6.4.1` advisory | `package.json`, `package-lock.json` | [Phase 1](phase-01-upgrade-vulnerable-dependencies.md) |
| 3 | High | `GEMINI_API_KEY` injected into client bundle | `vite.config.ts`, `src/services/` | [Phase 5](phase-05-remove-client-gemini-secret-exposure.md) |
| 4 | Medium | `postcss` advisory | `package.json`, `package-lock.json` | [Phase 1](phase-01-upgrade-vulnerable-dependencies.md) |
| 5 | Medium | `@protobufjs/utf8` advisory | `package-lock.json` | [Phase 1](phase-01-upgrade-vulnerable-dependencies.md) |
| 6 | Medium | `brace-expansion` transitive advisory | `package-lock.json` | [Phase 1](phase-01-upgrade-vulnerable-dependencies.md) |
| 7 | Medium | Unrestricted image upload validation | `src/components/ImageUploader.tsx`, `src/components/MultiImageUploader.tsx`, `src/utils/` | [Phase 3](phase-03-harden-image-upload-validation.md) |
| 8 | Medium | Google Drive sync queue race | `src/hooks/useGoogleDriveSync.ts`, `src/contexts/ImageGalleryContext.tsx` | [Phase 4](phase-04-fix-google-drive-sync-queue-race.md) |
| 9 | Low | Dev server binds to `0.0.0.0` by default | `vite.config.ts` | [Phase 2](phase-02-harden-vite-dev-server-defaults.md) |

## Phase Plan

| Phase | Title | Status | Priority | Depends on |
|---:|---|---|---|---|
| 1 | Upgrade vulnerable dependencies | completed | P1 | None |
| 2 | Harden Vite dev server defaults | completed | P2 | None |
| 3 | Harden image upload validation | completed | P1 | Phase 1 |
| 4 | Fix Google Drive sync queue race | completed | P1 | Phase 1 |
| 5 | Remove client Gemini secret exposure | completed | P1 | Phase 1, Phase 2 |
| 6 | Verify security fixes and update docs | completed | P1 | Phase 1-5 |

## Cross-Plan Dependencies

Existing unfinished plan: `plans/20260521-1203-wardrobe-mode-virtual-tryon`. It mentions security in passing but does not overlap primary files or delivery scope. No `blockedBy` or `blocks` relationship is required.

## Architecture Direction

Keep current app boundaries:
- UI components stay thin.
- Hook layer owns feature state and validation flow.
- Service calls stay centralized through `src/services/imageEditingService.ts` and Gemini service modules.
- API keys must not come from hook state and must not be embedded into production client bundles.

For the Gemini key exposure, the durable fix is a Vercel/Netlify serverless proxy. Production calls must route through the existing service facade instead of bypassing `imageEditingService.ts`. Local development may keep direct Gemini mode only as an explicit non-production escape hatch.

## Global Success Criteria

- [ ] `npm audit` has no remaining findings for the vbsec-reported packages or an explicit accepted-risk note is documented.
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] Production bundle inspection confirms no Gemini API key or `GEMINI_API_KEY` value is shipped.
- [ ] Invalid uploads are rejected for SVG, unknown MIME, oversized files, and mismatched magic bytes.
- [ ] Google Drive queue drains when `folderId` becomes available; no silent upload loss.
- [ ] `vbsec-reports/scan-2026-05-22-113905.md` findings are all closed or explicitly accepted with rationale.

## Validation Commands

```bash
npm install
npm audit
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

For bundle secret verification, use a repo-safe inspection command during implementation and report only the result, not any secret value.

## Risks

- Dependency upgrades can alter Gemini SDK behavior; test real image generation paths after lockfile changes.
- Removing client-side Gemini key injection requires Vercel/Netlify serverless proxy implementation and clear dev/prod mode separation.
- Upload validation may reject images users previously accepted; clear UI error strings are required.
- Google Drive sync race fix touches async queue behavior; tests must cover delayed folder availability.

## Validation Decisions

- Gemini proxy target: Vercel/Netlify serverless function.
- Local Gemini mode: direct client mode is allowed only for explicit non-production development.
- Upload size cap: 20 MB.
- Security report outputs: add `vbsec-reports/` to `.gitignore` after remediation so future scans remain local unless deliberately committed.

## Open Questions

None.
