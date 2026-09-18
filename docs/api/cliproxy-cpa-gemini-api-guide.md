# CPA Gateway — Gemini API Contract

> Measured live: **2026-09-17** (re-verified) on top of the original **2026-06-02** pass.
> Base URL: `https://cliproxy.monet.uno`
> API key: build/runtime setting, never committed (`CLIPROXY_API_KEY` at build time, or the
> Settings value stored under `cpa_gateway_api_key`).

This gateway is the app's **Gemini lane** (`gemini-native` driver): the only route the app
uses for Gemini text and Gemini image work. Google Cloud credentials are not needed here —
the proxy holds the upstream authentication and the client only presents its own key.

The image lane is a different gateway: OpenAI-style generation and edits go through
`docs/api/xompet-image-api-guide.md`, never through this one.

## Connection

| Item | Value |
| --- | --- |
| Base URL | `https://cliproxy.monet.uno` (`DEFAULT_CPA_GATEWAY_URL`) |
| Host constant | `CPA_GATEWAY_HOST = 'cliproxy.monet.uno'` in `src/config/imageModelCatalog.ts` — the Gemini lane's gateway, and never a source of image-lane capability facts |
| Auth | `Authorization: Bearer <key>` **or** `x-api-key: <key>` — both accepted |
| Client wiring | `configureGeminiClient({ apiKey, baseUrl })` in `src/services/apiClient.ts`; the gateway key is the only accepted credential, there is no direct-Google fallback |
| Content-Type | `application/json` |

## Endpoints

| Method | Path | Style |
| --- | --- | --- |
| `POST` | `/v1/chat/completions` | OpenAI-compatible |
| `GET` | `/v1/models` | OpenAI-compatible list |
| `POST` | `/v1beta/models/{model}:generateContent` | Google Gemini-style (the app's route) |
| `GET` | `/v1beta/models` | Google-style model list |

## Models

`GET /v1/models` answered **200 with 32 models in 0.23 s** on 2026-09-17. The image group it
returned: `gemini-3.1-flash-image`, the alias `agy/gemini-3.1-flash-image`, plus
`gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`.

The app registers exactly one image model on this route: **`gemini-3.1-flash-image`**
(`src/config/modelRegistry.ts`). The Pro, Lite and 2.5 image rows answer **400** here, so
they are deliberately absent. Text defaults to `gemini-3.8-flash`.

The old "Gemini 3.0/3.1 ids must carry the `-preview` suffix or the proxy answers 502" note
from the 2026-06-02 pass is **no longer true**: on the current build `gemini-3.1-flash-image`
without the suffix answers 200, as does its `agy/` alias.

## `POST /v1beta/models/{model}:generateContent`

```bash
curl -sS -X POST "https://cliproxy.monet.uno/v1beta/models/gemini-3.1-flash-image:generateContent" \
  -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{
    "contents": [{ "parts": [{ "text": "a red cube on a white table" }] }],
    "generationConfig": { "imageConfig": { "aspectRatio": "3:4", "imageSize": "2K" } }
  }'
```

| Observation (2026-09-17) | Result |
| --- | --- |
| `imageConfig.aspectRatio` + `imageSize` | **honoured exactly** — 9:16 @ 1K/2K/4K ⇒ 768x1376 / 1536x2752 / 3072x5504; 1:1 @ 2K ⇒ 2048x2048; 3:4 @ 2K ⇒ 1792x2400 |
| Response shape | image arrives in `parts[].inlineData`, mime **`image/jpeg`** (no alpha, regardless of the request) |
| `imageConfig` omitted | the gateway returns **1408x768** (landscape) ⇒ always send `aspectRatio` explicitly |
| `POST /v1/images/generations` here | accepts only `gpt-image-*` / `grok-imagine-*`; `gemini-3.1-flash-image` answers **400** with the supported list. For `gpt-image-*` the **`size` and `quality` fields are ignored** (always 1254x1254; `gpt-image-2.5` answers 1369x1149) — which is why the image lane does not use this route |

Capability flags derived from these measurements live in `src/config/imageModelCatalog.ts`
under the `cliproxy.monet.uno` gateway override, and every consumer reads them through
`resolveCapabilities` rather than assuming the vendor contract.

## Re-verify recipe (cheap, no guessing)

```bash
KEY=...   # Settings value or CLIPROXY_API_KEY

# 1. catalogue (free)
curl -sS "https://cliproxy.monet.uno/v1/models" -H "Authorization: Bearer $KEY"

# 2. does the image id still answer, and at what dimensions? (1 image)
curl -sS -X POST "https://cliproxy.monet.uno/v1beta/models/gemini-3.1-flash-image:generateContent" \
  -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"a red cube"}]}],"generationConfig":{"imageConfig":{"aspectRatio":"1:1","imageSize":"1K"}}}'
# decode the returned inlineData and read its real pixel size — never trust a claim, measure it

# 3. probe the app's own request path end to end (1 call)
#    the app sends the same body through configureGeminiClient; a mismatch surfaces in the
#    Settings gateway check as ok | unauthorized | forbidden | unreachable | malformedShape
```

## Related notes

- Image lane reference gateway: `docs/api/xompet-image-api-guide.md`
- Capability model and gateway profiles: `docs/decisions/0008-image-model-driver-and-gateway-discovery.md`
