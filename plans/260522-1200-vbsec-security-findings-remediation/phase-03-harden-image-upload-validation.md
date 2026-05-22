---
phase: 3
title: "Harden Image Upload Validation"
status: completed
priority: P1
effort: "4-6h"
dependencies: [1]
---

# Phase 3: Harden Image Upload Validation

## Context Links

- Source report: `vbsec-reports/scan-2026-05-22-113905.md`
- Related files: `src/components/ImageUploader.tsx`, `src/components/MultiImageUploader.tsx`, `src/utils/imageUtils.ts`, `src/locales/en.ts`, `src/locales/vi.ts`
- Finding: medium #7

## Overview

Add upload boundary validation for single and multi-image upload flows. Reject oversized, unsupported, spoofed, SVG, or unknown image files before reading and compressing them.

## Key Insights

- Current upload logic checks `file.type.startsWith('image/')`, which trusts browser-provided MIME metadata.
- Validation belongs at the browser input boundary before `FileReader` and `compressImage` run.
- Components should remain thin, so shared validation should live in `src/utils/` or a hook-level helper, with components only calling the helper and rendering user-friendly errors.

## Requirements

- Functional: allow JPEG, PNG, and WebP uploads; preserve existing preview and compression behavior.
- Functional: reject SVG, unknown MIME, mismatched extension/MIME/magic bytes, and files above 20 MB.
- Non-functional: validation code is reusable across single and multi uploaders; no business logic duplicated between components.

## Architecture

Extend `src/utils/imageUtils.ts` with pure validation helpers that accept `File` objects and return immutable validation results. The utility should check:

- Size cap: 20 MB.
- MIME allowlist: `image/jpeg`, `image/png`, `image/webp`.
- Magic bytes: JPEG `ff d8 ff`, PNG `89 50 4e 47`, WebP `RIFF....WEBP`.
- Reject `image/svg+xml` explicitly.

The components call the utility before reading files and use existing `useLanguage()` strings for errors.

## Related Code Files

- Modify: `src/utils/imageUtils.ts`
- Modify: `src/components/ImageUploader.tsx`
- Modify: `src/components/MultiImageUploader.tsx`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/vi.ts`
- Create or modify tests under `__tests__/` mirroring touched files.

## Implementation Steps

1. Before editing symbols, run GitNexus impact analysis for upload handlers and any extracted validation function.
2. Extend `src/utils/imageUtils.ts` with typed validation results and no mutation.
3. Update `ImageUploader.tsx` to await validation before `FileReader` and `compressImage`.
4. Update `MultiImageUploader.tsx` to validate every selected file and report all rejected files clearly.
5. Add i18n strings for unsupported type, oversized file, invalid image signature, and partial multi-file rejection.
6. Add tests for JPEG, PNG, WebP, SVG rejection, unknown MIME rejection, oversized rejection, and magic-byte mismatch.
7. Run `npm run test`, `npx tsc --noEmit`, `npm run lint`, and browser smoke tests with files from `docs/image-test/`.

## Todo List

- [ ] Enforce 20 MB max upload size.
- [ ] Extend `src/utils/imageUtils.ts` with pure validation helpers.
- [ ] Wire validation into single uploader.
- [ ] Wire validation into multi uploader.
- [ ] Add localized error strings.
- [ ] Add unit tests.
- [ ] Smoke-test valid and invalid uploads.

## Success Criteria

- [ ] JPEG, PNG, and WebP files pass validation when size and signature are valid.
- [ ] SVG, unknown MIME, oversized files, and signature mismatches are rejected before file read/compression.
- [ ] Existing upload flows continue to work with `docs/image-test/people.jpg`, `outfit.jpg`, and `shoes.jpg`.
- [ ] Tests, lint, and type-check pass.

## Risk Assessment

Risk is medium-low. Some valid but uncommon image formats will be rejected by design. Mitigate with clear UI messages and a deliberately small allowlist.

## Security Considerations

Client validation improves safety and UX but is not a complete trust boundary for any future backend upload. If uploads are later sent to a server, repeat validation server-side.

## Next Steps

Proceed to Phase 6 verification after upload validation tests pass.
