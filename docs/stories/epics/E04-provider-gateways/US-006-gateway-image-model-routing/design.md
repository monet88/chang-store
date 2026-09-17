# Design

Layer 1 = the catalog. Layer 2 = profiles + discovery. Both are client-side only.

## Domain Model

```ts
// src/config/imageModelCatalog.ts  (new, <=200 LOC)

/** API shape used to reach a model. One driver per measured request/response contract. */
export type ImageDriverId =
  | 'gemini-native'      // POST {base}/v1beta/models/{model}:generateContent, imageConfig, parts[].inlineData
  | 'openai-images'      // POST {base}/images/generations (JSON) + /images/edits (multipart image[])
  | 'grok-images';       // POST {base}/images/generations|edits with aspect_ratio + resolution + data-URI images

export interface ImageModelCapabilities {
  driver: ImageDriverId;
  sizeMode: 'ratio' | 'pixel';           // which vocabulary the driver accepts in `size` / `imageConfig`
  sizes: readonly string[];              // pixels ('1080x1920') when sizeMode==='pixel', ratios ('9:16') otherwise
  defaultSize: string;
  resolutions?: readonly ImageResolution[];   // drivers that take a separate resolution/quality-of-scale knob
  /**
   * Measured, never assumed — and a round-robin gateway can be inconsistent: xompet
   * honoured `size:1080x1920` in 2 of 3 identical calls and answered 1254x1254 in the third.
   * `flaky` keeps the size control visible, makes the dimension guard mandatory, and shows
   * the observed rate in the discovery panel.
   */
  honorsSize: 'yes' | 'no' | 'flaky';
  sizeObservations?: { honored: number; total: number };
  honorsQuality: boolean;
  supportsTransparentBackground: boolean;
  responseShapes: readonly ('b64_json' | 'url' | 'echo_fields')[];
  verifiedAt: string;                    // ISO date of the last live probe behind these flags
}

export interface ImageModelDescriptor {
  modelId: string;                       // id sent upstream, verbatim
  label: string;
  providerId: ProviderId | 'cpa';        // 'grok' | 'gptImage' | 'cpa'
  capabilities: ImageModelCapabilities;  // default (usually the vendor's own API)
  /**
   * Capabilities are a property of the (gateway, model) pair, not of the model id:
   * the same id can honor `size` on one gateway and ignore it on another (measured:
   * gpt-image-2.5-sunburst). Keys are bare hosts, e.g. 'cliproxy.monet.uno'.
   */
  gatewayOverrides?: Record<string, Partial<ImageModelCapabilities>>;
  notes?: string;
}

/** Most specific wins: descriptor defaults, then the active gateway's override. */
export const resolveCapabilities = (
  descriptor: ImageModelDescriptor,
  gatewayHost: string,
): ImageModelCapabilities => ({ ...descriptor.capabilities, ...descriptor.gatewayOverrides?.[gatewayHost] });
```

Registry rules (business invariants, enforced by a catalog test):

1. `modelId` is unique across the catalog; `sizes` is non-empty and contains `defaultSize`.
2. `sizeMode === 'pixel'` ⇒ every entry matches `/^\d+x\d+$/`; `sizeMode === 'ratio'` ⇒ every entry matches `/^\d+:\d+$/`.
3. `driver === 'grok-images'` ⇒ `sizeMode === 'ratio'`; `driver === 'gemini-native'` ⇒ `sizeMode === 'ratio'`.
4. `honorsSize === 'no'` ⇒ the UI must not offer a size dropdown for that model (single fixed size). `'flaky'` ⇒ the dropdown stays, the dimension guard always runs, and the observed rate is displayed.
5. `verifiedAt` is required — an entry without live evidence does not belong in the catalog.
6. `driver` values map onto the existing seam: each driver is a `ProviderImageDriver` implementation (`src/hooks/providerStudioGenerationTypes.ts:22`) or a Gemini service adapter, so no new abstraction is introduced.
7. Exactly one response-shape adapter exists for all `openai-images` models; shape tolerance is a driver property, not a per-model one.
8. `gatewayOverrides` keys are bare hosts (no scheme, path, or port unless non-default) and every override carries its own `verifiedAt`; a merged capability set has exactly one evidence date — the one that supplied it.
9. `resolveCapabilities(descriptor, gatewayHost)` is the only way request builders, pickers, and tests read capabilities; nothing reads `descriptor.capabilities` directly (that is how the two gateways would silently disagree again).
10. **A profile belongs to exactly one lane** (`gemini` = the CPA/Gemini route, `image` = dedicated OpenAI-Images / Grok gateways) and one driver. A gateway that exposes both surfaces is added twice — once per lane — so no request builder ever has to guess which API shape a base URL speaks. Model pickers are lane-scoped: the Gemini features see Gemini-lane models only, the image studios see image-lane models only.
11. **Gateways have an owner lane.** The CPA gateway is the `gemini` lane's gateway and is **not** seeded into the `image` lane, even though it implements `/v1/images/generations` (measured 200 for `gpt-image-*`). The `image` lane is populated by OpenAI-Images-specialised gateways the operator adds (xompet is the reference implementation). Rationale: those gateways honour the image contract they advertise — pixel `size`, `background`, `response_format` — while a CPA answers the same request in its own fixed size. Adding CPA to the image lane stays possible, explicitly, and the measured override then hides the size control.

### Catalog seed (measured 2026-09-17 — one live generation per row)

**Lane `image`, `openai-images` driver.** Requested each time: `size=1080x1920`, `quality=high`, `background=transparent`, `output_format=png`, `response_format=b64_json`.

| modelId | gateway host | HTTP | returned | honorsSize | honorsQuality | transparent | responseShapes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `gpt-image-2.5-sunburst` | `api.xompet.io.vn` | 200 · 22–62 s | **1080x1920** in 2 of 3 calls, **1254x1254** in 1 | **flaky (2/3)** | no (`high`→`medium`/`low`) | yes (alpha 0) | `b64_json`, `url`, `echo_fields` |
| `gpt-image-2.5-sunburst` | `cliproxy.monet.uno` | 200 · 34.8 s | 1254x1254 | **no** | no | yes | `echo_fields` + `b64_json` |
| `gpt-image-2.5-flare` | `cliproxy.monet.uno` | 200 · 36.8 s | 1254x1254 | no | no | yes | `echo_fields` + `b64_json` |
| `gpt-image-2.5` | `cliproxy.monet.uno` | 200 · 38.8 s | **1369x1149** (non-square) | no | no | yes | `echo_fields` + `b64_json` |
| `gpt-image-2` | `cliproxy.monet.uno` | 200 · 122 s | 1254x1254 | no | no | yes | `echo_fields` + `b64_json` |
| `gpt-image-1.5`, `grok-imagine-image`, `grok-imagine-image-quality`, `grok-imagine-image-2.0` | `cliproxy.monet.uno` | not driven yet | — | re-verify | — | — | listed by the gateway's own 400 as supported on this route |

The same `modelId` (`gpt-image-2.5-sunburst`) honors `size` on one gateway and ignores it on the other — this is exactly what `gatewayOverrides` exists for. `honorsSize: false` means **the size control is hidden**, and the dimension guard is the only thing protecting the user.

**Lane `gemini`, `gemini-native` driver.** Requested: `imageConfig.aspectRatio` + `imageSize` (the app's `IMAGE_RESOLUTIONS` scale).

| ratio | `imageSize` | returned | actual ratio | KB | time |
| --- | --- | --- | --- | --- | --- |
| `9:16` | `1K` | **768x1376** | 0.5581 | 467 | 14.0 s |
| `9:16` | `2K` | **1536x2752** | 0.5581 | 1711 | 22.0 s |
| `9:16` | `4K` | **3072x5504** | 0.5581 | 6256 | 32.6 s |
| `1:1` | `2K` | **2048x2048** | 1.0 | 1944 | 24.4 s |
| `3:4` | `2K` | **1792x2400** | 0.7467 | 1791 | 25.6 s |
| `9:16` | *(none)* | **1408x768** | 1.8333 | 641 | 16.2 s |

⇒ both knobs are honored exactly (`1K → 2K → 4K` doubles each dimension) on `gemini-3.1-flash-image` and on the `agy/gemini-3.1-flash-image` alias (200, same route). Without `imageConfig` the model answers **landscape**, so the driver must always send an explicit ratio.

| modelId | gateway host | HTTP | result |
| --- | --- | --- | --- |
| `gemini-3.1-flash-image` | `cliproxy.monet.uno` | 200 · 14–33 s | `parts[].inlineData`, image/jpeg, ratio + size honored (table above), `finishReason: STOP` |
| `agy/gemini-3.1-flash-image` | `cliproxy.monet.uno` | 200 · 25.0 s | `inlineData` image/jpeg — the `agy/` alias works on the same route |
| `gemini-3.1-flash-image` on `/images/generations` | `cliproxy.monet.uno` | **400 · 0.2 s** | “Model … is not supported on /v1/images/generations or /v1/images/edits” ⇒ route-specific driver, as designed |

**Lane `image`, `grok-images` driver (xAI):** unchanged from `grokModelRegistry.ts` (`GROK_ASPECT_RATIOS` + `GROK_RESOLUTIONS`); not re-measured this session ⇒ `re-verify`.

Rows still marked `re-verify` ship **disabled** (visible in the picker, not selectable) — the catalog must never state an unmeasured capability as fact.

### Gateway quirks the catalog must encode

> Full measured contract for the image-lane reference gateway (endpoints, accepted body
> shapes, error table, re-verify recipes): `docs/api/xompet-image-api-guide.md`. Gemini-lane
> counterpart: `docs/api/cliproxy-vertex-ai-api-guide.md`.

1. **User-Agent sensitivity.** `api.xompet.io.vn` answers `403 error code: 1010` (Cloudflare) for a non-browser User-Agent and `200` for `curl`/Chrome with the same key — verified on `/v1/models` and on generation. The app is a browser so it is unaffected; **probe tooling must send a browser UA**, and discovery must map `403` to its own status (`forbidden`) instead of reporting a bad key.
2. **The 400 tells you the supported set.** An unsupported id on the CPA images route returns `400 … "Model X is not supported on /v1/images/generations or /v1/images/edits. Use <list>…"`. Log it and show it in the discovery panel as a hint — informational only, never parsed as a source of truth (the wording is gateway-build specific).
3. **`quality` is a no-op on both gateways** (echoed back as `medium`). Do not offer a quality control that cannot change the output; keep sending it only if it costs nothing.
4. **`gemini-native` defaults to landscape** (1408x768). Every Gemini-lane request must send an explicit `imageConfig.aspectRatio`; relying on the default silently produces landscape fashion shots.
5. **Routes are driver-specific, not model-specific.** `gemini-3.1-flash-image` is 200 on `/v1beta/models/{id}:generateContent` and 400 on `/images/generations`; `gpt-image-*` is the reverse. This is why a profile carries a lane and a driver, and why a model is only offered in the lane it can actually serve.
6. **Ownership is by gateway, not by capability.** A CPA that happens to accept `gpt-image-*` on its images route is still the Gemini lane's gateway: it ignores `size` (1254x1254, or 1369x1149 for `gpt-image-2.5`), so pointing the image lane at it degrades every generation to the gateway's own size. The image lane is for gateways that honour the OpenAI Images contract (xompet: `size` exact, `background: transparent` real, `response_format` honoured). Where the same `modelId` exists on both, its descriptor keeps a `gatewayOverrides['cliproxy.monet.uno']` entry so an explicit opt-in is still safe.
7. **`/v1/models` returns the key's entitlement, not the gateway's catalogue.** xompet's own vendor doc lists four image models; this key returns `403 quota_error / model_not_allowed` for three of them (`gpt-image-2`, `gpt-image-2.5-flare`, `gemini-3.1-flash-image-preview`) and lists exactly one (`gpt-image-2.5-sunburst`). Entitlement is per key ⇒ the catalog∩served rule is the only correct picker behaviour, and a 403 with a `model_not_allowed` body is a permissions answer about that **model**, not a broken gateway.
8. **`n > 1` is accepted and ignored.** `n: 2` returned one image with HTTP 200 — same for `response_format: "url"`, which came back as `b64_json`. The client keeps `n = 1` and fans out calls itself, and must accept `b64_json` and `url` regardless of what it asked for.
9. **The vendor's multi-image JSON body is wrong.** `{"image": ["data:…", "data:…"]}` ⇒ `400 images[].image_url is required`; the accepted JSON shape is `images: [{image_url: {url: "<data uri>"}}]`. The single-image forms do work: JSON `"image": "<data uri>"` (200) and multipart `-F image=@file` / `-F image[]=@file` (200). A client written from the doc alone breaks on exactly the multi-reference case the app needs most.

## Application Flow

### Lớp 1 — capability-driven request building

```
feature/destination (feature-local prompt + refs)
        │  picks { modelId, size }
        ▼
catalog lookup → ImageModelCapabilities  =  resolveCapabilities(descriptor, hostOf(activeProfile.baseUrl))
        │
        ├── driver=openai-images → gptImageService   (send only honored fields; response_format:'b64_json')
        ├── driver=grok-images   → grokImageService  (aspect_ratio + resolution + data-URI images)
        └── driver=gemini-native → gemini/image.ts   (imageConfig.aspectRatio + imageSize)
                 │
                 ▼
        parse → b64_json | url (fetch → base64) | echo_fields
                 │
                 ▼
        dimension guard: compare returned WxH with the requested size (when honorsSize)
```

Field discipline: **a driver sends only the fields its capabilities claim are honored**, because both gateways silently swallow unknown fields (`aspect_ratio`/`resolution`/`input_urls` were all ignored with HTTP 200 on `openai-images`). Any field dropped for capability reasons is logged through `debugService` (never `console.log`).

### Lớp 2 — profiles (two lanes) and discovery

```
Settings → Gateway profiles
   ┌─ lane "gemini"  (CPA, 1 profile) ───┐    ┌─ lane "image"  (gateway chuyên OpenAI Images) ────┐
   │ profile {label, baseUrl, apiKey}    │    │ profile A {label, baseUrl, apiKey, openai-images} │
   │ mặc định: cliproxy.monet.uno        │    │ mẫu: xompet                                       │
   │ driver: gemini-native               │    │ profile B {…, openai-images}  ← thêm bao nhiêu cũng được
   │ exactly one is active               │    │ profile C {…, grok-images}                        │
   └───────────────┬─────────────────────┘    └───────────────┬───────────────────────────────────┘
                   │ "Kiểm tra" (per profile)                  │ "Kiểm tra" (per profile)
                   ▼                                           ▼
        gatewayDiscoveryService.listModels(profile)   (same service, same contract)
                   │                                           │
                   └──────────────► GET {baseUrl}/v1/models ◄──┘
                   │                                           │
        ok / unauthorized / unreachable / malformedShape        │
                   ▼                                           ▼
   Gemini model picker =                       GPT Image studio = pick a profile, then
   catalog(driver=gemini-native) ∩ served      catalog ∩ served(profile)   [+ grok studio: grok-images]
```

Why the split (operator's own workflow): the CPA gateway is the Gemini route and stays a single active profile, while gpt-image gateways are numerous and cheap, so the image lane accepts any number of profiles and each one is checked independently. A model picker never mixes the two lanes, and a profile never speaks two API shapes.


Discovery is **user-triggered only** (settings open or explicit refresh): never on app boot, so no unsolicited key-bearing network call and no surprise latency.

## Interface Contract

### `GET {baseUrl}/v1/models` (discovery)

- Request: `Authorization: Bearer <apiKey>`, no query string. 10 s `AbortSignal.timeout`.
- 200 success body (both gateways, verified): `{"object":"list","data":[{"id":"...","object":"model","owned_by":"...","created"?:0}]}`.
- `GET /v1/models/{id}` is **404** on both gateways — discovery is list-only; never probe per model.
- Status mapping: `200` + parseable `data[]` ⇒ `ok`; `401` ⇒ `unauthorized` (bad key); **`403` ⇒ `forbidden`** (gateway/edge blocked the request — measured on a UA-sensitive gateway, so this must never be reported as a bad key); other non-2xx, network failure, or abort ⇒ `unreachable`; 2xx without a `data[]` array ⇒ `malformedShape`.
- Response DTO:

```ts
export type GatewayProbeStatus = 'ok' | 'unauthorized' | 'forbidden' | 'unreachable' | 'malformedShape';
export interface GatewayProbeResult {
  status: GatewayProbeStatus;
  modelIds: string[];
  ownedBy: Record<string, string>;
  latencyMs: number;
  httpStatus?: number;
}
```

- Measured budget: 0.23 s (32 ids) and 0.36 s (1 id); CORS is `Access-Control-Allow-Origin: *` for GET and `204` + `Allow-Headers: *` for the OPTIONS preflight ⇒ **no proxy needed**.

### Model filtering

```ts
// src/config/modelSelectionRules.ts  (existing seam, extended)
export const resolveSelectableModels = (
  selectionType: ModelSelectionType,
  served?: readonly string[],      // undefined = discovery not run yet
): SelectableModel[];              // catalog ∩ served, plus served-unknown entries flagged `unverified`
```

- Discovery not run (`served === undefined`) ⇒ today's behavior (static list) — the feature degrades to the current UX, never to an empty picker.
- Discovery ran and returned `ok` ⇒ only served models are selectable.
- `catalog \ served` is shown disabled with `error.gateway.modelNotServed` tooltip; `served \ catalog` is shown with an `unverified` badge.

### Image response adapter (openai-images driver)

```ts
// src/services/providers/shared/openaiCompatibleResponse.ts  (existing seam, extended)
// 1. item.b64_json → use directly
// 2. item.url only → fetch(url) → arrayBuffer → base64   (same-origin-free: measured ACAO echoes the request Origin)
// 3. neither → ProviderUnsupportedResponseError('error.provider.response.unknownShape')
```

`error.provider.response.urlOnly` stays only for the case where the URL fetch itself fails. `generateGptImage`/`editGptImage` additionally send `response_format: 'b64_json'` (currently absent), which removes the ambiguity at the source for gateways that honor it.

### Dimension guard

After parsing, when `capabilities.honorsSize` is true and `sizeMode === 'pixel'`: `const { width, height } = await getImageDimensions(base64, mimeType)` (existing util, `src/utils/imageUtils.ts:91`) and compare with the requested `WxH`. Mismatch ⇒ `debugService` warning + one non-blocking UI notice (`errors.imageSizeMismatch`, naming requested vs returned). The image is still kept: a wrong-size image beats a lost one, and the measured silent fallback is the exact bug this guard exists for.

## Data Model

localStorage only (no server, no migrations):

```ts
export type GatewayLane = 'gemini' | 'image';

export interface GatewayProfile {
  id: string;                            // stable slug, used in storage keys and in the picker
  label: string;                         // operator-facing, e.g. "xompet" / "gateway rẻ #3"
  baseUrl: string;
  apiKey: string;
  lane: GatewayLane;                     // 'gemini' → CPA route; 'image' → GPT-image / Grok route
  driver: ImageDriverId;                 // lane 'gemini' ⇒ gemini-native; lane 'image' ⇒ openai-images | grok-images
  enabled: boolean;                      // disabled profiles stay stored but are hidden from pickers
}
```

| Key | Shape | Notes |
| --- | --- | --- |
| `gateway_profiles_v1` | `GatewayProfile[]` | ordered; many `lane:'image'` entries is the normal case |
| `active_gateway_profile_v1` | `string` | the **gemini-lane** profile id used by `configureGeminiClient` |
| `active_image_profile_v1` | `string` | the image-lane profile currently selected in the GPT Image / Grok studios |
| `gateway_models_cache_v1` | `{baseUrl, fetchedAt, modelIds, ownedBy}` | TTL 10 min; keyed by base URL, never by key |
| `cpa_gateway_url`, `cpa_gateway_api_key`, `vertex_proxy_url`, `vertex_proxy_api_key` | legacy strings | read-migrated → profile `{id:'cpa-default', lane:'gemini', driver:'gemini-native'}` |
| `provider:${provider}:baseUrl|apiKey` | legacy strings | read-migrated → `grok` ⇒ `{lane:'image', driver:'grok-images'}`, `gptImage` ⇒ `{lane:'image', driver:'openai-images'}` |

`CpaGatewaySettings {url, apiKey}` (`ApiProviderContext.tsx:18`) stays the derived view of the **active gemini-lane** profile so `configureGeminiClient` (`ApiProviderContext.tsx:213`) keeps working unchanged; the image lane keeps using the existing `provider:${provider}:*` accessors, now backed by profiles.


## UI / Platform Impact

- `SettingsModal.tsx` CPA section ⇒ extracted `GatewayProfileEditor.tsx` (+ paired `useGatewayProfiles.ts`) with **two lists**: *Gateway Gemini (CPA)* — single active profile; *Nhà cung cấp ảnh (GPT/Grok)* — many profiles, each with label, base URL, key, driver, enable toggle, and its own **Kiểm tra** button + status line (`ok · 32 mô hình · 0.23s` or the mapped error). Extraction is mandatory, not optional: `SettingsModal.tsx` and `useSettingsModalState.ts` are already at the 200-LOC ceiling from `docs/code-standards.md`.
- GPT Image studio (and Grok studio) gain a **provider/profile selector** above the model selector: choose profile → its served models. No cross-profile union: a profile is picked first, exactly like the operator's mental model ("provider này có model gì").
- Gemini features (Try-On, Identity Transfer, …) keep their current model dropdown, now filtered by the gemini-lane profile's served list.
- Model pickers render two groups: **Đã kiểm tra** / **Chưa xác minh** (served by the profile but absent from the catalog ⇒ generic driver, size not offered, dims verified after each call).
- GPT Image size dropdown is driven by `resolveCapabilities(descriptor, host).sizes`, so `1080x1920` (9:16) becomes selectable; models with `honorsSize === false` hide the control.
- Mobile: no new breakpoints; the editor uses existing modal layout primitives.
- i18n: add keys to **both** `src/locales/en.ts` and `src/locales/vi.ts` (`settingsModal.gatewayProfiles.*`, `modelSelector.unverified`, `errors.gateway.*`, `errors.imageSizeMismatch`); `__tests__/locales/key-parity.test.ts` enforces parity.

## Observability

`debugService` only (production `console.log` is prohibited):

- `gateway.discovery` — profile label, base URL host, status, model count, latency (never the key).
- `provider.response` — shape chosen (`b64_json` | `url` | `echo_fields`), bytes, elapsed.
- `provider.request` — driver, model, size, dropped-for-capability fields.
- `image.dimensionMismatch` — requested vs returned `WxH`, model, driver.

## Alternatives Considered

1. **Runtime capability probing** (probe `size`/`quality`/transparent per model to learn behavior). Rejected: each probe costs a paid generation and takes 20–90 s; `/v1/models` carries no capability metadata (verified: only `id/object/owned_by/created`).
2. **Keep the three static registries, add a fourth.** Rejected: four vocabularies for the same concept is exactly the drift this story removes.
3. **Server-side proxy for discovery or generation.** Rejected: measured `Access-Control-Allow-Origin: *` + OPTIONS 204 on both gateways; a proxy adds a deployment surface for zero benefit.
4. **New `ImageProvider` abstraction beside `ProviderImageDriver`.** Rejected: `ProviderImageDriver` (`src/hooks/providerStudioGenerationTypes.ts:22`) already is the seam; a second one is prohibited by `docs/code-standards.md` conventions and by the in-flight hook-split work (`OPS-HOOK-SPLIT-001`, `MAINT-HOOK-SPLIT-02`).
5. **Auto-run discovery on app boot.** Rejected: it sends the user's key on page load without being asked, and makes first paint depend on a third-party host.
