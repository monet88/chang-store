# Provider Studios (Gemini / Grok / GPT Image)

## Purpose

Chang Store is not Gemini-only. A header-level studio switch lets the user move
between three isolated studios that all produce fashion imagery but use
different AI providers and request contracts:

- **Gemini** — the default, full-featured studio (all ten `Feature`
  workflows + Gallery + model selectors).
- **Grok** — isolated xAI image studio for five workflows.
- **GPT Image** — isolated OpenAI image studio for five workflows.

This doc is the product contract for the studio split. The authoritative
technical description lives in `docs/ARCHITECTURE.md` ("Studio Modes" and
"Provider Studio Parity Matrix"); this doc states the user-visible behavior.

## Studio Mode

`StudioMode = 'gemini' | 'grok' | 'gptImage'` (in `src/types.ts`). `AppContent`
holds it in state, default `'gemini'`. The header `StudioModeSwitch` (a
three-segment radio group) toggles it.

Switching studios:

- Unmounts the previous studio (no state preserved between studios).
- Clamps `activeFeature` to a provider-supported feature when leaving Gemini,
  so Gemini-only features never leak into a provider studio.
- Provider studios render their own content area — they do **not** share the
  Gemini workspace header, global model selector, or Gallery.

## Supported Workflows

Provider studios support five of the ten workflows
(`PROVIDER_SUPPORTED_FEATURES` in `src/types.ts`):

| Workflow | Grok | GPT Image | Notes |
| --- | --- | --- | --- |
| Virtual Try-On | Yes | Yes | Source-item types/notes, background + extra fields, multi-person marker. |
| Lookbook | Yes | Yes | Full style/garment/fabric/negative controls; no variations/close-ups. |
| Clothing Transfer | Yes | Yes | Reference-outfit note per source item. |
| Pattern Generator | Yes | Yes | Prompt-driven; images optional. |
| AI Editor | Yes | Yes | Prompt + required source image. |

Gemini-only workflows **not** available in provider studios: Background
Replacer, Pose Changer, Photo Album, Watermark Remover, Identity Transfer.

Per-workflow UI descriptors live in
`src/components/studios/provider-studio/providerWorkflows.ts`.

## Provider Configuration

Provider keys and base URLs come from `ApiProviderContext` (per-provider
settings), seeded from build-time env values in `src/config/providerRegistry.ts`
and overridable via namespaced localStorage. They are never held in hook state.

| Provider | Default base URL | Env key | Env base URL |
| --- | --- | --- | --- |
| Grok | `https://api.x.ai/v1` | `GROK_API_KEY` | `GROK_BASE_URL` |
| GPT Image | `https://api.openai.com/v1` | `GPT_IMAGE_API_KEY` | `GPT_IMAGE_BASE_URL` |

Base URLs pass `validateProviderBaseUrl` (allowlist) before any bearer token is
sent. Env vars are injected via `vite.config.ts` with a `VITE_`-prefixed
fallback for local `.env` files.

## Service Contracts

Provider studios route through their own stateless services — never through
`imageEditingService.ts` or any Gemini module.

### Grok (`src/services/providers/grok/grokImageService.ts`)

- `generateGrokImage` → `POST {baseUrl}/images/generations` (JSON), always
  `response_format: 'b64_json'`.
- `editGrokImage` → `POST {baseUrl}/images/edits` (JSON). One source image uses
  the `image` object; 2–3 sources use the `images` array
  (`GROK_MAX_REFERENCE_IMAGES = 3`).
- Output count validated against `GROK_MIN_OUTPUTS`/`GROK_MAX_OUTPUTS`.
- Native resolution flag (`resolution: '2k'`) supports upscale.

### GPT Image (`src/services/providers/gpt-image/gptImageService.ts`)

- `generateGptImage` → `POST {baseUrl}/images/generations` (JSON),
  `n = GPT_IMAGE_OUTPUT_COUNT`.
- `editGptImage` → `POST {baseUrl}/images/edits` (multipart/form-data) with
  repeated `image[]` fields; `Content-Type` is **not** set manually (browser
  adds the multipart boundary). Max sources: `MAX_GPT_REFERENCE_IMAGES`.
- No native resolution flag — upscale uses a preservation prompt at
  `quality: 'high'`.

Both services normalize responses to `ImageFile[]` via the shared
OpenAI-compatible parser (`shared/openaiCompatibleResponse.ts`) and use the
shared `withRetry` (exponential backoff + jitter, `AbortSignal`),
`validatePrompt`, `safeFetch`, and typed `ProviderApiError`.

## Prompt Builder Reuse (read-only)

Provider studios reuse the Gemini prompt **builders** but not the Gemini
**pipeline**. `src/utils/provider-studio-prompt-adapter.ts` extracts the text
segments from `buildVirtualTryOnParts`, `buildClothingTransferParts`,
`buildPatternGeneratorParts`, and `buildLookbookPrompt`, then passes images to
the provider service separately. No Gemini hook, service, context, or
`imageEditingService.ts` call is made from a provider studio.

## Isolation Rules (Contract)

- Provider results are **local-only**: no Gallery writes, no IndexedDB gallery
  persistence, no cross-studio result sharing.
- Provider studios do not import Gemini prompt builders directly; they go
  through the adapter.
- Provider studios use separate model registries (`grokModelRegistry.ts`,
  `gptImageModelRegistry.ts`) and provider services.

## Parity vs Gemini

See the full "Provider Studio Parity Matrix" in `docs/ARCHITECTURE.md`. Summary
of deferred items (Grok and GPT Image): Lookbook variations, Lookbook close-ups,
and auto-describe-clothing (no provider text endpoint wired). GPT Image upscale
is prompt-based rather than a native resolution flag.

## Key Files

- `src/components/studios/StudioModeSwitch.tsx` — header switcher.
- `src/components/studios/GrokStudio.tsx` — Grok studio shell.
- `src/components/studios/GptImageStudio.tsx` — GPT Image studio shell.
- `src/components/studios/provider-studio/*` — shared provider UI
  (settings panel, results grid/tile, source fields, try-on extras, lookbook
  controls) and `providerWorkflows.ts`.
- `src/hooks/useGrokStudio.ts`, `src/hooks/useGptImageStudio.ts` — studio logic.
- `src/hooks/useProviderStudioFields.ts`, `useProviderResultActions.ts`,
  `useProviderTryOnBatch.ts`, `useProviderLookbookFields.ts` — shared hooks.
- `src/config/providerRegistry.ts`, `grokModelRegistry.ts`,
  `gptImageModelRegistry.ts` — provider metadata + model capabilities.
- `src/services/providers/{grok,gpt-image,shared}/*` — provider services.
- `src/utils/provider-studio-prompt-adapter.ts`,
  `provider-refine-prompt.ts`, `provider-url-validation.ts`.

## Validation Path

- Switch studio in header → previous studio unmounts, feature clamps to a
  supported workflow.
- Configure provider key/base URL → invalid base URL is rejected before any
  request.
- Try-On on Grok / GPT Image with default composed prompt → outfit applied,
  result rendered locally (not written to Gallery).
- Current automated proof: provider service and isolation tests under
  `__tests__/services/providers/`, `__tests__/hooks/useGrokStudio.test.tsx`,
  and `__tests__/hooks/useGptImageStudio.test.tsx`. The former
  `scripts/provider-tryon-smoke.ts` helper is not present in this checkout.

## Related Story

`docs/stories/epics/E01-provider-studios/US-001-three-provider-studios/`.
