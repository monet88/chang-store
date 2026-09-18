# Studios (Gemini / GPT Image)

## Purpose

Chang Store ships two studios behind a header-level switch. Both produce fashion
imagery through the same workflows; they differ in which image engine runs the
request:

- **Gemini** — the default studio, all ten `Feature` workflows.
- **GPT Image** — the OpenAI-compatible image lane, five workflows.

This doc is the product contract for the studio split. The authoritative
technical description lives in `docs/ARCHITECTURE.md` ("Studio Modes" and the
workflow matrix); this doc states the user-visible behavior.

## Studio Mode

`StudioMode = 'gemini' | 'gptImage'` (in `src/types.ts`). `AppContent` holds it
in state, default `'gemini'`. The header `StudioModeSwitch` (a two-segment radio
group) toggles it.

Switching studios:

- Unmounts the previous studio (no state is preserved between studios).
- Clamps `activeFeature` to a supported workflow when leaving Gemini, so
  Gemini-only features never leak into the GPT studio.
- Mounts the engine of the selected mode, so every feature view underneath
  talks to the right image lane without knowing which one it is.

## Supported Workflows

| Workflow | Gemini | GPT Image |
| --- | --- | --- |
| Virtual Try-On | Yes | Yes |
| Lookbook | Yes | Yes |
| Clothing Transfer | Yes | Yes |
| AI Editor | Yes | Yes |
| Identity Transfer | Yes | Yes |
| Background Replacer | Yes | No |
| Pose Changer | Yes | No |
| Photo Album | Yes | No |
| Watermark Remover | Yes | No |
| Pattern Generator | Yes | No |

`PROVIDER_SUPPORTED_FEATURES` (`src/types.ts`) lists the five GPT workflows; the
remaining five are phase 2 of the consolidation — their hooks already take their
driver from the shared engine context, they simply have no GPT view yet. The GPT
views live in `src/components/studios/Gpt*.tsx` and are deliberate twins of the
Gemini views: the workflow is the same, only the generation controls differ.

## The Engine Seam

`src/contexts/ImageEngineContext.tsx` exposes, for the active mode:

```ts
{ id, model, editImage, upscaleImage, createImageChatSession, modelOptions, setModel, noSelectableModel, options }
```

- The **Gemini lane** implements it with `src/services/imageEditingService.ts`
  (a real chat session, so refinement keeps conversation history).
- The **GPT lane** implements it with
  `src/services/providers/gpt-image/gptImageEngine.ts` over `gptImageService`:
  it maps the requested ratio to the pixel size the active `(gateway, model)`
  pair actually honors, and a refine becomes **one stateless edit** carrying the
  current image plus a preservation wrapper — there is no server-side history to
  continue.

Consequence to expect: consecutive GPT refinements do not accumulate context, so
lookbook variation/close-up consistency is weaker than Gemini's chat. The refine
control stays visible in the GPT views.

## Generation Controls

- Gemini views render aspect ratio + resolution (`ImageOptionsPanel`).
- GPT views render ratio, the pixel size that ratio resolves to, and quality
  (`src/components/studios/GptImageOptionsPanel.tsx`). Only the ratios the
  product offers on that lane appear, and both the size and the quality control
  are capability-driven: a gateway measured to ignore `quality` shows no
  selector, and a `flaky` size shows its measured honor rate.

## Provider Configuration

Settings → **Gateway** edits two lanes: the Gemini (CPA) profile and any number
of image-gateway profiles. The image lane is multi-profile; the active profile
supplies the GPT lane's base URL and key, and `gateway_profiles_v1` is the only
credential store — the legacy per-provider `provider:*` settings and their
`providerRegistry` metadata were removed.

- **Env seed**: a fresh install with no stored profiles gets one image profile
  built from `XOMPET_BASE_URL` / `GPT_IMAGE_BASE_URL` and
  `XOMPET_API_KEY` / `GPT_IMAGE_API_KEY` (build-time defines in
  `vite.config.ts`), defaulting the base URL to `https://api.openai.com/v1`.
- **Fail closed**: a profile with an empty base URL is never paired with a
  default address — the request fails instead of sending a gateway key to
  OpenAI.
- **Orphan cleanup**: stored `provider:grok:*` / `provider:gptImage:*` keys, and
  stored profiles whose driver no longer exists (`grok-images`), are dropped on
  load.
- **Check**: probes `GET {baseUrl}/v1/models` (10-minute cache), refuses an
  unusable address client-side, maps 401 to "gateway rejected this key" and 403
  to an edge/User-Agent block.

## Models and Capabilities

Model ids, sizes, and response shapes come from the capability catalog
(`src/config/imageModelCatalog.ts`), which is evidence-dated: each entry records
what was measured for a `(model, gateway)` pair, with per-gateway overrides keyed
by bare host. Studios list `catalog ∩ served(profile)` — models the gateway
actually answers for the configured key — and show served-but-unmeasured ids in a
separate group.

Controls follow capabilities rather than assumption: a model whose gateway is
measured to ignore `size` offers no size control, a `flaky` size shows the
measured honor rate, and a gateway that answers a different size than requested
marks the result tile with `requested → returned` (the image is kept). A `url`
response is downloaded and converted rather than rejected. Base URLs pass
`validateProviderBaseUrl` (allowlist) before any bearer token is sent.

## Service Contracts

The GPT lane routes through its own service and adapter — never through
`imageEditingService.ts` or any Gemini module.

- `generateGptImage` → `POST {baseUrl}/images/generations` (JSON),
  `n = GPT_IMAGE_OUTPUT_COUNT`.
- `editGptImage` → `POST {baseUrl}/images/edits` (multipart/form-data) with
  repeated `image[]` fields; `Content-Type` is **not** set manually (the browser
  adds the multipart boundary). Max sources: `MAX_GPT_REFERENCE_IMAGES`.
- No native resolution flag — upscale is a preservation-prompted edit at
  `quality: 'high'`.

Both normalize responses to `ImageFile[]` via the shared OpenAI-compatible parser
(`shared/openaiCompatibleResponse.ts`) and use the shared `withRetry`
(exponential backoff + jitter, `AbortSignal`), `validatePrompt`, `safeFetch`,
and typed `ProviderApiError`.

## Gallery

Both studios persist results to the same IndexedDB gallery, tagged with the
workflow that produced them and the engine that ran it, so a GPT result can be
sent into another workflow exactly like a Gemini one. The gallery keeps the most
recent 20 images (`GALLERY_SIZE_LIMIT`).

## Deliberate GPT Caps

Parity means the five workflows exist, not that every cap is raised: one output
per request (`n` is ignored), lookbook variations capped at one, wardrobe sets
bounded to two with `maxItemsPerSet: 4`, serial batches, and the documented
"multipart edits are slow and tunnel-timeout-prone" reason (~60-90s measured per
edit).

## Key Files

- `src/contexts/ImageEngineContext.tsx` — the studio-scoped engine seam.
- `src/hooks/useGptImageEngine.ts` — resolves profile, capabilities, model,
  quality and size for the GPT lane.
- `src/services/providers/gpt-image/gptImageEngine.ts` — the GPT implementation
  of the engine contract (ratio → size, single-shot refine).
- `src/utils/single-shot-refine-session.ts` — the stateless refine session used
  when the engine has no chat.
- `src/components/studios/StudioModeSwitch.tsx` — header switcher.
- `src/components/studios/GptStudio.tsx` + `Gpt*.tsx` — the GPT studio and its
  five cloned views; `GptImageOptionsPanel.tsx` — its generation controls.
- `src/config/imageModelCatalog.ts` — the capability catalog (drivers,
  capabilities, evidence dates, per-gateway overrides).
- `src/config/gatewayProfiles.ts`, `src/hooks/useGatewayProfiles.ts`,
  `useGatewayProfileEditor.ts`, `useServedModels.ts` — profile storage, the env
  seed, orphan cleanup, and the served-model cache.
- `src/services/gatewayDiscoveryService.ts` — `GET {baseUrl}/v1/models` with
  401/403/unreachable/malformed mapping and a 10-minute TTL cache.
- `src/components/modals/GatewayProfileEditor.tsx`, `GatewayProfileRow.tsx` —
  the two-lane profile editor.
- `src/services/providers/gpt-image/*`, `src/services/providers/shared/*` —
  the GPT service (`shared/imageDriverPolicy.ts` owns field discipline and the
  size guard).
- `src/utils/provider-refine-prompt.ts`, `provider-url-validation.ts`.

## Validation Path

- Switch studio in the header → the previous studio unmounts and the feature
  clamps to a supported workflow.
- Configure an image profile → an invalid base URL is rejected before any
  request (including from the profile's **Check**).
- Settings → Gateway → add an image profile, **Check** it → the served list
  appears and the studio's model dropdown narrows to `catalog ∩ served`; a
  reload keeps the profile and its selection.
- Try-On on GPT Image with the default composed prompt → outfit applied, result
  rendered and written to the gallery with its feature + engine tag.
- Automated proof: `__tests__/services/providers/gpt-image/gptImageEngine.test.ts`,
  `__tests__/components/studios/{GptStudio,GptImageOptionsPanel}.test.tsx`,
  `__tests__/config/{gatewayProfiles,imageModelCatalog,providerIsolation}.test.ts`,
  `__tests__/contexts/ApiProviderContext.test.tsx`.
