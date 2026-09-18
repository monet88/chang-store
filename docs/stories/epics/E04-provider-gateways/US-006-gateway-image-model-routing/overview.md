# Overview

**Story:** US-006-gateway-image-model-routing
**Lane:** high-risk (Harness intake #153)
**Plan layers:** Lớp 1 (image-model registry with real capabilities) + Lớp 2 (gateway profiles + model availability validation).

## Current Behavior

- **Three independent static model registries** with three different capability vocabularies:
  - `src/config/modelRegistry.ts` — Gemini models, `capabilities: { supportsImageSize, supportsAspectRatio, supportedImageSizes? }`, `selectionType` scope, `DEFAULT_MODEL_BY_SELECTION_TYPE`.
  - `src/config/gptImageModelRegistry.ts` — one model (`gpt-image-2`), `GPT_IMAGE_QUALITIES`, pixel `GPT_IMAGE_SIZES` (`auto/1024x1024/1536x1024/1024x1536`).
  - `src/config/grokModelRegistry.ts` — two models, `GROK_ASPECT_RATIOS`, `GROK_RESOLUTIONS`.
- **One hand-verified gateway credential pair**: `cpa_gateway_url` (default `https://cliproxy.monet.uno`) + `cpa_gateway_api_key` in `src/contexts/ApiProviderContext.tsx:44-46`, plus per-provider studio credentials `provider:${provider}:baseUrl|apiKey` (`providerRegistry.ts`: `grok`, `gptImage`).
- **No runtime model-availability check exists.** `src/config/modelRegistry.ts:35` documents the Gemini list as verified *by hand* against `https://cliproxy.monet.uno/v1/models`; nothing re-checks it.
- **Response handling rejects URL answers**: `src/services/providers/shared/openaiCompatibleResponse.ts:32-68` throws `ProviderUnsupportedResponseError('error.provider.response.urlOnly')` when a call returns `data[].url` without `b64_json`, and `generateGptImage` never sends `response_format` at all.
- **Capabilities are assumed, not measured**: `gptImageService` sends `size`/`quality` regardless of whether the gateway honors them; grok-style fields (`aspect_ratio`, `resolution`, `image` data URIs) are sent to whichever base URL is configured.

## Measured Reality (2026-09-17, live probes, recorded in validation.md)

| Observed | Consequence today |
| --- | --- |
| `size:"1080x1920"` → PNG **1080x1920** exact; `size:"9:16"` → **1024x1536** with HTTP 200 and no warning | The app can request a wrong-size image and never notice |
| `quality:"high"` echoed back as `medium` | Quality control is cosmetic on this gateway |
| `background:"transparent"` + `output_format:"png"` → real alpha (PNG colorType 6, alpha 0 corners) | Capability exists but the app never uses it |
| `data[].url` responses observed (`img.apimatou.cc`, `ACAO` echoes Origin) | App throws `urlOnly` and drops a perfectly good image |
| `GET /v1/models` → 200 on both gateways (**32** ids on cliproxy, **1** on xompet), `ACAO: *`, OPTIONS 204, `/v1/models/{id}` 404 | Availability is cheaply discoverable in-browser; nothing uses it |

## Target Behavior

**Lớp 1 — capability-driven image-model catalog.** One registry (`src/config/imageModelCatalog.ts`) holds every image model the app can drive, each with a `driver` (API shape), a size vocabulary (`ratio` vs `pixel`), and explicit honored/ignored field flags. The three existing registries become views derived from that catalog, so UI lists, size dropdowns, and request builders stop disagreeing.

**Lớp 2 — gateway profiles (two lanes) + availability validation.** Profiles are split by route family, matching how the app actually talks to the world:
- **Lane `gemini` — gateway CPA duy nhất** (mặc định `https://cliproxy.monet.uno`): một profile đang hoạt động, đi qua `configureGeminiClient`; driver `gemini-native`.
- **Lane `image` — các gateway chuyên cho OpenAI Images** (xompet là mẫu; Grok/xAI là driver thứ hai): N profile, mỗi cái `{label, baseUrl, apiKey, driver}`; studio chọn provider trước, rồi chọn model.

CPA **không** được đưa vào làn `image` mặc định, dù nó có implement route OpenAI Images (đã đo: `/v1/images/generations` trả 200 cho `gpt-image-*`). Muốn dùng thì operator tự thêm CPA như một profile làn `image`, và khi đó `gatewayOverrides` đã ghi sẵn sự thật đo được (bỏ qua `size` ⇒ ẩn control size). Nhờ vậy hai làn không bao giờ nhoè vào nhau.

Each profile has its own **Kiểm tra** action (`GET {baseUrl}/v1/models`) reporting `ok | unauthorized | forbidden | unreachable | malformedShape`; pickers offer *registry ∩ served for that profile*, marking served-but-unregistered models as **chưa xác minh** (generic driver, no size control, dims verified after each generation). Generated images are dimension-checked against the request and mismatches surface instead of passing silently.

## Affected Users

- Owner/operator of the local fashion app (single-user browser app; no multi-tenant surface).

## Affected Product Docs

- `docs/product/provider-studios.md`
- `docs/product/identity-transfer.md` (model + size selection)
- `docs/decisions/0008-image-model-driver-and-gateway-discovery.md` (new)

## Non-Goals

- No server-side proxy and no gateway-server change (`gateway/**` untouched): measured CORS makes browser-side discovery work.
- No automatic capability probing — capability facts cost credits; they stay in the registry with a `verifiedAt` date.
- No changes to prompt builders, gallery, batch concurrency, or any feature flow beyond model/size selection plumbing.
- No new provider UI: Grok and GPT Image studios keep their existing panels, now fed by the catalog.
