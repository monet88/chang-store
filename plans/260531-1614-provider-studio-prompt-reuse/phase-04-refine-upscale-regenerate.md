---
phase: 4
title: "Refine, Upscale and Regenerate-Single"
status: complete
priority: P1
effort: "6h"
dependencies: [2]
---

# Phase 4: Refine, Upscale and Regenerate-Single

## Overview

Add the three post-generation tools Gemini results have but provider results lack: iterative
**refine**, **upscale** (2K/4K), and **regenerate single**. All reuse the existing provider
edit/generate endpoints — no native chat or upscale API needed (Gemini itself does these
client-side).

## Requirements

- Functional: Each provider result tile gets Refine (prompt → edit using that image as
  source), Upscale (2K/4K preservation edit), and Regenerate (re-run the original request for
  that slot).
- Functional: Refine maintains a client-side per-tile history (latest image fed back), mirroring
  `chat.ts`. Grok upscale may use native `resolution: '2k'`; otherwise a preservation prompt.
- Non-functional: Logic in hooks; `ProviderResultsGrid` gains controls but stays presentational.
  Reuse `editGrokImage`/`editGptImage`; extend services only if strictly required.

## Architecture

- Refine: `refine(resultIndex, prompt)` → call provider `edit` with `images:[results[index]]`
  + a preservation-wrapped prompt; replace that result slot. Keep a `refineHistory[index]`.
- Upscale: `upscale(resultIndex, quality)` → Grok: set `resolution` and/or use the Gemini
  `UPSCALE_PROMPTS` text via the provider edit endpoint; GPT: edit with the preservation prompt.
- Regenerate single: re-invoke `handleGenerate`'s core for one slot (refactor the per-call body
  into a reusable `runOne(params)` used by generate, refine, regenerate).
- Reuse `imageEditingService` upscale **prompts** as shared constants (text only) — do not call
  the Gemini service from provider hooks.

## Related Code Files

- Modify: `src/hooks/useGrokStudio.ts`, `src/hooks/useGptImageStudio.ts`
- Modify: `src/components/studios/provider-studio/ProviderResultsGrid.tsx` (per-tile controls)
- Possibly create: `src/utils/provider-refine-prompt.ts` (preservation wrapper for refine/upscale)
- Read: `src/services/gemini/chat.ts` (refine pattern), `src/services/imageEditingService.ts`
  (`UPSCALE_PROMPTS`), `src/hooks/useVirtualTryOn.ts` (`handleRefine`/`handleUpscale`/`handleRegenerateSingle`)

## Implementation Steps

1. Refactor each hook's generation body into `runOne(params, signal)` returning `ImageFile[]`.
2. Implement `refine(index, prompt)`: provider edit with `[results[index]]` + preservation
   wrapper; replace slot; push to `refineHistory[index]`.
3. Implement `upscale(index, quality)`: Grok native `resolution` when available, else
   preservation-prompt edit; replace slot.
4. Implement `regenerateSingle(index)`: re-run `runOne` with the original params for that slot.
5. Add per-tile controls to `ProviderResultsGrid` (refine input, upscale 2K/4K, regenerate),
   wired through new hook return fields.
6. i18n for new controls (EN + VI).
7. `npx tsc --noEmit`, `npm run lint`; unit tests mock the service and assert the right call shape.

## Success Criteria

- [ ] Refine edits a single provider result iteratively (history kept client-side).
- [ ] Upscale produces a higher-res variant (Grok 2K native verified; GPT via prompt).
- [ ] Regenerate-single replaces one tile without touching others.
- [ ] Existing routing/error tests still pass; new tests cover refine/upscale/regenerate.
- [ ] `npx tsc --noEmit`, `npm run lint` clean.

## Risk Assessment

- **Provider has no chat memory**: acceptable — Gemini also re-sends context client-side.
- **Upscale fidelity on GPT**: prompt-based upscale may not truly increase pixels. Mitigation:
  use the largest supported `size`/`quality`; document the provider limit in Phase 7 matrix.
- **AbortController**: ensure refine/upscale/regenerate respect the existing abort-on-switch.
