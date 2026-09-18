# XomPet Images API — Measured Contract

> Measured live: **2026-09-17** (one generation per row; every claim below came from a
> real call, not from the vendor document).
> Base URL: `https://api.xompet.io.vn/v1`
> API key: build/runtime setting, never committed. Current working key belongs to the
> operator's `gpt-image-2.5-sunburst` plan.
> Vendor document checked: `Tai_lieu_ket_noi_API_XomPet_v2.txt` — its claims that are
> wrong or missing are listed in [Vendor document errata](#vendor-document-errata).

This gateway is the **reference implementation of the app's image lane** (`openai-images`
driver): it honours the OpenAI Images contract for pixel `size`, real transparency, and
reference edits. The CPA gateway is *not* interchangeable with it.

## Connection

| Item | Value |
| --- | --- |
| Base URL | `https://api.xompet.io.vn/v1` |
| Auth | `Authorization: Bearer <key>` |
| Content-Type | `application/json` (generations) · `multipart/form-data` (edits with files) |
| CORS | `Access-Control-Allow-Origin: *`, OPTIONS 204, `Allow-Headers: *` ⇒ callable straight from the browser, no proxy |
| **User-Agent** | Must look like a browser. A non-browser UA (`Python-urllib/3.x`) gets **`403 error code: 1010`** (Cloudflare) on `/v1/models` *and* on generation with the same key; `curl/*` and Chrome UAs get 200 |

## Model availability is per key

`GET /v1/models` works, is fast (≈0.3 s), costs nothing, and returns **the key's
entitlement**, not the gateway's catalogue:

```json
{"object":"list","data":[{"id":"gpt-image-2.5-sunburst","object":"model","created":1789644202,"owned_by":"cunai-gpt-image"}]}
```

- `GET /v1/models/{id}` ⇒ **404** on this gateway (list only).
- Ids sold by the shop but **not** in this key's plan answer
  `403 {"type":"quota_error","code":"model_not_allowed","message":"Model X is not allowed for this API key."}`.
  Measured for `gpt-image-2`, `gpt-image-2.5-flare`, `gemini-3.1-flash-image-preview`.
- ⇒ A picker must offer `catalogue ∩ /v1/models`, and `model_not_allowed` means
  "not in this key's plan", not "gateway broken".

## `POST /v1/images/generations`

```json
{
  "model": "gpt-image-2.5-sunburst",
  "prompt": "A single red cube, centered, no shadow, on a fully transparent background.",
  "n": 1,
  "size": "1080x1920",
  "quality": "high",
  "background": "transparent",
  "output_format": "png",
  "response_format": "b64_json"
}
```

| Field | Honoured? | Evidence |
| --- | --- | --- |
| `size` | **yes, pixel only — and not always** | `1536x1024` and `1080x1920` returned exactly (PNG IHDR verified). The **same** `1080x1920` request returned **1080x1920, 1080x1920, then 1254x1254** across three calls ⇒ verify the returned dimensions, per call |
| `size` as a ratio string | **no, silently** | `"9:16"` ⇒ HTTP **200** with a `1024x1536` (2:3) image and no warning |
| `background: "transparent"` | **yes** | PNG colorType 6, alpha `0` at both top corners (also true on the CPA gateway) |
| `output_format` | yes (echoed) | `png` echoed back; pair with `background` for alpha (JPEG/WebP cannot carry it) |
| `response_format` | **unreliable** | `"b64_json"` → b64; `"url"` → usually a URL, but one call returned `b64_json` anyway ⇒ handle both |
| `quality` | **no** | sent `high`, echoed `medium` (once `low`); the image does not change with it |
| `n` | **no** | `n: 2` ⇒ HTTP 200 with **one** image |
| `aspect_ratio`, `resolution`, `input_urls` | **no** | silently ignored (kie/grok-style vocabulary is not this contract) |

Observed latency: **22 s → 122 s** per image, 0.3–6.3 MB PNG. Use a request timeout of
**≥180 s**; the vendor example's 60/90 s will cut real generations off.

## `POST /v1/images/edits`

Accepted body shapes (all verified 2026-09-17):

| Shape | Result |
| --- | --- |
| JSON `{"image": "data:image/png;base64,…"}` (one image) | **200** |
| JSON `{"images": [{"image_url": {"url": "data:image/png;base64,…"}}]}` (multi) | **200** (trimmed to 3 images in the app's own test) |
| JSON `{"image": ["data:…","data:…"]}` (the **vendor doc's** multi-image shape) | **400 `images[].image_url is required`** |
| multipart `-F "image=@file;type=image/png"` | **200** (62–97 s observed) |
| multipart `-F "image[]=@file"` (repeated, what the app's `gptImageService` sends) | **200** |

Reference images: PNG or JPG, **< 10 MB each** (vendor FAQ). No published maximum count;
the app caps at 3 for edits and 10 for its own reference list.

## Response envelopes — handle all three

1. `{"created":…,"data":[{"b64_json":"…","revised_prompt":"…"}]}` — the cleanest; no echo fields.
2. `{"created":…,"background":"transparent","output_format":"png","quality":"medium","size":"1254x1254","usage":{…},"data":[{"b64_json":"…","generation_id":"…"}]}` — the gateway echoes what it *accepted*, which is **not** proof it honoured it.
3. `{"created":…,"data":[{"url":"https://img.apimatou.cc/i/….png","revised_prompt":"…"}]}` — the URL CDN reflects the request `Origin` in `Access-Control-Allow-Origin`, so a browser fetch → bytes → base64 works.

A client that requires `b64_json` will drop real images; a client that trusts the echoed
`size` will silently ship the wrong one.

## Errors

| Status | Body | Meaning |
| --- | --- | --- |
| 401 | `{"error":{…}}` | bad/absent key |
| 403 | `{"type":"quota_error","code":"model_not_allowed"}` | this key is not entitled to that model |
| 403 | `error code: 1010` (Cloudflare) | edge/WAF block — usually a non-browser User-Agent, **not** a key problem |
| 400 | `images[].image_url is required` | multi-image JSON sent in the vendor doc's shape |
| 400 | `model … not supported on /v1/images/…` (CPA gateway wording) | model belongs to the other route/driver |
| 499 | client-side | client's own timeout closed the socket; raise it (≥180 s) |

## Vendor document errata

`Tai_lieu_ket_noi_API_XomPet_v2.txt` is a **shop catalogue**, not a key contract. Wrong or
missing there, verified here:

1. **Model table ≠ key entitlement.** It lists four image models; this key owns one. `/v1/models` is the truth; §8 of the doc ("type the models you bought") is the only hint it gives.
2. **Multi-image JSON body is wrong.** `"image": ["data:…","data:…"]` ⇒ 400. Use `images: [{image_url: {url}}]`.
3. **`n` is not honoured** — every example uses `n: 1`, so the doc never discovers that `n: 2` returns one image.
4. **`size` is pixel-only** and a ratio string fails silently; the doc's sizes are examples, not a whitelist.
5. **Results are not deterministic** — identical calls returned 1080x1920 twice and 1254x1254 once. The doc promises the requested size.
6. **`response_format` is not guaranteed** — a `"url"` request can return b64.
7. **No `GET /v1/models`** anywhere, though it is the only entitlement check available.
8. **No error catalogue** — and 403 has two completely different meanings (see above).
9. **No mention of** `background: "transparent"`, `output_format`, `output_compression`, `quality` behaviour, or the three response envelopes.
10. **Unknown support** (undocumented, unmeasured): `mask` (inpainting), `input_fidelity`, `partial_images`/`stream`, `moderation`, maximum `n`, maximum reference images, pixel bounds.
11. **Timeouts** in the examples (60/90/120 s) are below real generation latency (up to 122 s observed).
12. **Chat route with an image model** (§6 promises images "in the chat") never says what the client must parse — the CPA gateway returns a markdown `data:image/png;base64,…` string in `parts[].text` in that scenario, which the app's `extractInlineImagePart` cannot read.

## Re-verify recipe (cheap, no guessing)

```bash
KEY=...; UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'

# 1. entitlement (free)
curl -sS "https://api.xompet.io.vn/v1/models" -H "Authorization: Bearer $KEY" -H "User-Agent: $UA"

# 2. size honoured? (1 credit) — decode the PNG IHDR of the answer, never trust the echoed `size`
curl -sS -X POST "https://api.xompet.io.vn/v1/images/generations" \
  -H "Authorization: Bearer $KEY" -H "User-Agent: $UA" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-image-2.5-sunburst","prompt":"A single red cube on a fully transparent background","n":1,"size":"1080x1920","background":"transparent","output_format":"png","response_format":"b64_json"}'

# 3. edit shapes (1 credit each) — JSON single, JSON multi (images[].image_url), multipart image[]
```

## Plan implications

- Capability flags for this gateway are declared in `src/config/imageModelCatalog.ts` (planned in US-006):
  `honorsSize: 'flaky'` + `sizeObservations`, `honorsQuality: false`, `supportsTransparentBackground: true`,
  `responseShapes: ['b64_json','url','echo_fields']`.
- The dimension guard (`getImageDimensions`) is mandatory for this gateway, not a nicety.
- Discovery maps `403 model_not_allowed` separately from `403 error code: 1010`.

## Re-verify 2026-09-18 — Identity Transfer edit path

The app's real Identity Transfer request (`buildIdentityTransferParts`: destination + the bundled
`docs/images/FACE_ANGLES.png` face sheet + `docs/images/BODY.png`) was sent through the exact
multipart shape `editGptImage` builds (`model`, `prompt`, `n=1`, `response_format=b64_json`,
`size`, repeated `image[]`):

| Observation | Result |
| --- | --- |
| `POST /v1/images/edits` with three `image[]` parts | **200** |
| Latency | **47.1 s** — inside the 22–122 s band, faster than the 62–97 s edits measured in September |
| Prompt | 3705 chars / 11 blocks accepted, no truncation signal |
| `size: "1024x1536"` | **honoured exactly** (PNG IHDR 1024x1536 for a 1024x1536 request), and nothing was echoed |
| Envelope | shape 1: `{created, data:[{b64_json, revised_prompt}], usage}` — clean, no `size`/`quality` echo |
| `n: 1` | one image |
| Output | pose, outfit, accessories, framing and scene preserved; facial identity taken from the face sheet |

This adds a second honoured data point for `1024x1536` (the ratio-`3:4` mapping) and confirms the
app's own multipart reference shape works with three images. It does not change the `flaky` verdict:
one honoured call is not a rate.

### Second call, same request (2026-09-18, after the prompt-authority fix)

| Observation | Result |
| --- | --- |
| Status / latency | **200** in **20.0 s** — latency on this gateway varies widely (20 s vs 47 s for the same request) |
| `size: "1024x1536"` | honoured again (IHDR 1024x1536) — 2/2 for this size on this key |
| Envelope | `{created, data, usage, image_poll}` with items carrying **only** `b64_json` — no `revised_prompt` |

⇒ The envelope varies between calls even within the same shape family (extra keys appear, item keys
come and go). A parser must read `data[].b64_json` or `data[].url` and ignore every other key —
never key off `usage`, `image_poll`, or `revised_prompt`.
