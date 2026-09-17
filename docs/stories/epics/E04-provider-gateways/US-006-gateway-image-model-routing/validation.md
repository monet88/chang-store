# Validation

## Proof Strategy

Three independent layers, in this order:

1. **Unit (vitest, deterministic).** Catalog invariants; capability-driven request bodies; response adapter (b64 / url / unknown); discovery status mapping against a mocked `fetch`; profile storage + legacy migration; picker intersection rules; dimension-guard mismatch path.
2. **Red-first proof for the new behavior.** The `url`-only response test must fail on HEAD with `ProviderUnsupportedResponseError('error.provider.response.urlOnly')` and pass after the adapter lands. Discovery tests must fail on HEAD (`gatewayDiscoveryService` does not exist).
3. **Live gateway probes (no credits).** Both gateways' `/v1/models` through a real browser (the app's own fetch path), asserted for status + model count + CORS. One paid generation (operator-approved) proves the `1080x1920` size path and the dimension guard.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Catalog: unique ids, non-empty `sizes` containing `defaultSize`, pixel/ratio format per `sizeMode`, driver↔sizeMode rules, `verifiedAt` present, `gatewayOverrides` keys are bare hosts with their own `verifiedAt`, `resolveCapabilities` merge order, `honorsSize` tri-state (`'no'` hides the control, `'flaky'` keeps it and records the observed rate). Driver: only capability-honored fields sent; `size` omitted only when `honorsSize === 'no'`; `response_format: 'b64_json'` present; a Gemini-lane request always carries an explicit `aspectRatio`; `n` is always 1 (the gateway ignores `n > 1`). Adapter: `b64_json` used directly; `url` fetched and converted; `b64_json` returned although `url` was requested is accepted; neither ⇒ `unknownShape`; fetch failure keeps `urlOnly`. Discovery: 200 `{data:[{id,owned_by}]}` ⇒ `ok` + ids; 401 ⇒ `unauthorized`; **403 with a `model_not_allowed` body ⇒ that model is unentitled (not a gateway failure)**; **403 `error code: 1010` ⇒ `forbidden`**; 500/network/abort ⇒ `unreachable`; 200 `{}` ⇒ `malformedShape`; cache hit inside TTL does not re-fetch. Profiles: legacy `cpa_gateway_url`/`cpa_gateway_api_key`/`vertex_proxy_*` migrate into the gemini-lane profile once; `provider:grok|gptImage:*` migrate into image-lane profiles with the right driver; active-profile change re-configures the Gemini client. Pickers: `served === undefined` ⇒ static list; `ok` ⇒ intersection only; `catalog \ served` disabled with reason; `served \ catalog` flagged `unverified`; lanes never mix. Guard: returned `1254x1254` for requested `1080x1920` ⇒ warning emitted, image kept. |
| Integration | Settings → **Kiểm tra** against a mocked gateway renders `ok · N mô hình`; 401 renders `error.gateway.unauthorized`; the selected model survives a refresh (localStorage round-trip). |
| E2E | Real browser smoke (CDP/dev server): open settings, run **Kiểm tra** against `https://cliproxy.monet.uno`, see the model count; pick `gpt-image-2.5-sunburst` + `1080x1920`; one generation returns a PNG whose IHDR is `1080x1920` (colorType 6 when transparent is on). |
| Platform | Key-parity test for `en.ts`/`vi.ts`; existing mobile layout untouched. |
| Performance | Discovery stays under 2 s on both gateways (measured 0.23 s / 0.36 s); no discovery call on boot (assert fetch spy count is 0 before the user opens settings). |
| Logs/Audit | `debugService` events `gateway.discovery`, `provider.response`, `provider.request`, `image.dimensionMismatch` carry host/status/latency/shape — never the API key. |

## Fixtures

- Mock fetch bodies: `{"object":"list","data":[{"id":"gpt-image-2.5-sunburst","object":"model","owned_by":"cunai-gpt-image"}]}` (xompet shape, 1 id); the 32-id cliproxy list recorded in `validation.md`; `{}`; `{"error":{"message":"invalid api key"}}` with 401; a rejected promise.
- Image item fixtures: `{b64_json:"<1x1 png base64>"}`; `{url:"https://example.test/i/x.png"}`; `{}`.
- Legacy storage fixture: `cpa_gateway_url=https://cliproxy.monet.uno`, `cpa_gateway_api_key=sk-test`, `vertex_proxy_url=https://legacy.test`.
- Live probe fixture (read-only, no credit): the recorded `/v1/models` responses of both gateways.

## Commands

Live discovery probe (recorded evidence, reproducible):

```bash
# cliproxy: 32 ids; xompet: 1 id. Both 200, ACAO:*, OPTIONS 204, /v1/models/{id} 404
curl -sS -D - "https://cliproxy.monet.uno/v1/models" -H "Authorization: Bearer $CLIPROXY_API_KEY" -H "Origin: http://localhost:5173"
curl -sS "https://api.xompet.io.vn/v1/models" -H "Authorization: Bearer $X0MPET_KEY"
curl -sS -i -X OPTIONS "https://api.xompet.io.vn/v1/models" -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization"
```

Paid size proof (1 credit, operator-approved; IHDR check in the skill probe script):

```bash
# size "1080x1920" -> PNG 1080x1920 colorType 6, alpha 0 corners  (verified 2026-09-17)
# size "9:16"      -> PNG 1024x1536, HTTP 200, no warning        (the silent fallback this story guards)
```

Repo gates:

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

## Acceptance Evidence

Recorded 2026-09-17 from live calls (this is the baseline the tests pin):

- `POST /v1/images/generations` (`gpt-image-2.5-sunburst`, xompet): `size:"1080x1920"` ⇒ 200 in 56.3 s, PNG **1080x1920**, colorType 6, alpha `0` at both top corners, `response_format:"b64_json"` honored, 1.40 MB.
- Same endpoint with `size:"9:16"` ⇒ 200 in 93.9 s, PNG **1024x1536** (2:3), response echoed `quality:"medium"` although `high` was sent — **no error, no warning**.
- `POST /v1/images/edits`: multipart `image[]` with 1 and 3 files ⇒ 200; JSON without `image_url` ⇒ 400 `images[].image_url is required`.
- `GET /v1/models`: cliproxy 200 · 32 ids in 0.23 s (6 image-capable: `gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, `gemini-3.1-flash-image`, `agy/gemini-3.1-flash-image`); xompet 200 · 1 id in 0.36 s (`gpt-image-2.5-sunburst`). CORS `Access-Control-Allow-Origin: *`; OPTIONS 204 `Allow-Headers: *`; `/v1/models/{id}` 404 on both.
- Own CPA gateway (earlier probe, same day): `size`/`quality` ignored ⇒ always `1254x1254`, and errors are returned as HTTP 200 with an error body.

### Capability matrix (probe run 2026-09-17, one generation per row)

Lane `image`, requested `size=1080x1920` + `quality=high` + `background=transparent` + `output_format=png` + `response_format=b64_json`:

| modelId | gateway | HTTP · time | returned | honorsSize | quality echoed | transparent |
| --- | --- | --- | --- | --- | --- | --- |
| `gpt-image-2.5-sunburst` | `api.xompet.io.vn` | 200 · 25 s (Chrome UA) / 56 s (curl UA) | **1080x1920** | **yes** | `medium` (sent `high`) | alpha 0 ✓ |
| `gpt-image-2.5-sunburst` | `cliproxy.monet.uno` | 200 · 34.8 s | 1254x1254 | no | `medium` | alpha 0 ✓ |
| `gpt-image-2.5-flare` | `cliproxy.monet.uno` | 200 · 36.8 s | 1254x1254 | no | `medium` | alpha 0 ✓ |
| `gpt-image-2.5` | `cliproxy.monet.uno` | 200 · 38.8 s | **1369x1149** | no | `medium` | alpha 0 ✓ |
| `gpt-image-2` | `cliproxy.monet.uno` | 200 · 122 s | 1254x1254 | no | `medium` | alpha 0 ✓ |
| `gemini-3.1-flash-image` | `cliproxy.monet.uno` | **400** · 0.2 s | `Model … is not supported on /v1/images/generations …` (message lists the supported set) | — | — | — |
| `gpt-image-2.5-sunburst` | `api.xompet.io.vn` (python UA) | **403** · 0.3 s | `error code: 1010` (Cloudflare, UA-based) | — | — | — |

Lane `gemini`, requested `imageConfig.aspectRatio` + `imageSize` (all 200, `image/jpeg` via `parts[].inlineData`, `finishReason: STOP`):

| ratio | imageSize | returned | actual ratio | KB | time |
| --- | --- | --- | --- | --- | --- |
| `9:16` | `1K` | 768x1376 | 0.5581 | 467 | 14.0 s |
| `9:16` | `2K` | 1536x2752 | 0.5581 | 1711 | 22.0 s |
| `9:16` | `4K` | 3072x5504 | 0.5581 | 6256 | 32.6 s |
| `1:1` | `2K` | 2048x2048 | 1.0 | 1944 | 24.4 s |
| `3:4` | `2K` | 1792x2400 | 0.7467 | 1791 | 25.6 s |
| `9:16` | *(none)* | 1408x768 | 1.8333 | 641 | 16.2 s |

⇒ `aspectRatio` and `imageSize` are honored exactly (1K/2K/4K double both dimensions); the no-config default is landscape.

UA sensitivity (free, `/v1/models`): `cliproxy` 200 for python/curl/Chrome; `xompet` **403 for python-urllib**, 200 for curl and Chrome with the same key.

### Vendor doc reconciliation — `Tai_lieu_ket_noi_API_XomPet_v2.txt` (checked 2026-09-17)

Claims in the vendor document vs measured against the live gateway:

| Vendor doc claim | Measured | Verdict |
| --- | --- | --- |
| Image models: `gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, `gemini-3.1-flash-image-preview` | `/v1/models` lists **one** (`gpt-image-2.5-sunburst`); the other three return `403 quota_error / model_not_allowed` for this key | doc describes the shop's catalogue, not the key's entitlement |
| Sizes `1024x1024`, `1024x1792`, `1792x1024` | `1080x1920` and `1536x1024` honoured at pixel precision; a **ratio string `9:16` silently returns 1024x1536**; the same `1080x1920` request for `gpt-image-2.5-sunburst` returned **1080x1920 twice and 1254x1254 once** | pixel sizes work, docs must forbid ratio strings, and the result is not deterministic |
| `response_format: "url"` ⇒ URL response | usually true, but one call requested `"url"` and received `b64_json` | both shapes must be handled |
| `n: 1` in every example | `n: 2` accepted with HTTP 200 but returns **one** image | `n > 1` is ignored |
| Edits JSON: `"image": "data:…"` (one image) | **200** (34.3 s) | correct |
| Edits JSON: `"image": ["data:…","data:…"]` (2+ images) | **400 `images[].image_url is required`** | **wrong** — the accepted shape is `images: [{image_url: {url}}]` |
| Edits multipart `-F "image=@file"` | **200** (62 s) | correct (as is `image[]`) |
| Timeouts in examples: 60 s / 90 s / 120 s | observed 22 s → 122 s for a single image, 97 s for an edit | examples are too tight; use ≥180 s |
| "PNG/JPG < 10MB each" (FAQ) | not contradicted; no max-dimension or max-reference count documented | incomplete limits |

Missing from the vendor doc entirely (each one an integration hazard):

1. `GET /v1/models` — never mentioned, though it is the only way to learn the key's entitlements (the doc instead tells operators to type their model list by hand).
2. Any error catalogue: no 401/403/429/400 shapes. Two different 403s exist — `quota_error / model_not_allowed` (model not in the key's plan) vs Cloudflare `error code: 1010` (User-Agent blocked).
3. The ratio-string trap (`"9:16"` ⇒ HTTP 200 + wrong size, no warning) and the requirement to verify returned dimensions.
4. `background: "transparent"` / `output_format` / `output_compression` — measured working (PNG colorType 6, alpha 0), undocumented ⇒ an unused capability.
5. `quality` — undocumented and **ignored** by the gateway (sent `high`, echoed `medium`/`low`).
6. Non-determinism across identical calls (size honoured 2/3) and the three response envelope shapes (`b64_json`+`revised_prompt`, echo-fields+`generation_id`, `url`).
7. `mask`, `input_fidelity`, `partial_images`/`stream`, `moderation` — unknown support, needed for watermark removal and face fidelity.
8. Max `n`, max reference images, pixel bounds, output formats.
9. What the chat route (`/v1/chat/completions` with an image model) returns — §6 promises images "in chat" but never says the client must parse a markdown data-URL.
10. CORS (measured open: `Access-Control-Allow-Origin: *`), so browser clients can call the gateway directly.


Add results here after each phase: test counts, the browser smoke capture, and the generation's IHDR.
