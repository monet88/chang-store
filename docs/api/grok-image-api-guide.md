# Grok Image API Planning Notes

Status: planning reference for `plans/260530-1351-three-provider-studios/`. The app runtime is still Gemini-only until the provider studio implementation lands.

## Contract Source

- xAI image generation docs: `https://docs.x.ai/developers/model-capabilities/images/generation`
- xAI image editing docs: `https://docs.x.ai/developers/model-capabilities/images/editing`
- xAI multi-image editing docs: `https://docs.x.ai/developers/model-capabilities/images/multi-image-editing`
- xAI REST Images reference: `https://docs.x.ai/developers/rest-api-reference/inference/images`

Recheck these official docs immediately before implementation.

## Authentication

- Base URL: `https://api.x.ai/v1`
- Header: `Authorization: Bearer $XAI_API_KEY`
- Do not commit real API keys or local proxy tokens.

## Generation

Endpoint: `POST /v1/images/generations`

```json
{
  "model": "grok-imagine-image-quality",
  "prompt": "A fashion editorial product photo",
  "n": 1,
  "aspect_ratio": "2:3",
  "resolution": "1k",
  "response_format": "b64_json"
}
```

Notes:

- `n` supports 1 to 10 outputs.
- The REST Images reference documents `response_format: "b64_json"` and `data[].b64_json` for image output.
- xAI supports `aspect_ratio` presets including `1:1`, `2:3`, `3:2`, `9:16`, and `16:9`, plus `resolution` values `1k` and `2k`.

## Editing

Endpoint: `POST /v1/images/edits`

Single-image edit:

```json
{
  "model": "grok-imagine-image-quality",
  "prompt": "Change the jacket to black leather",
  "image": {
    "type": "image_url",
    "url": "data:image/jpeg;base64,..."
  },
  "resolution": "1k",
  "response_format": "b64_json"
}
```

Multi-image edit:

```json
{
  "model": "grok-imagine-image-quality",
  "prompt": "Place the outfit on the model",
  "images": [
    { "type": "image_url", "url": "data:image/jpeg;base64,..." },
    { "type": "image_url", "url": "data:image/jpeg;base64,..." }
  ],
  "aspect_ratio": "3:2",
  "resolution": "1k",
  "response_format": "b64_json"
}
```

Notes:

- xAI image editing uses JSON, not multipart.
- Multi-image editing supports up to 3 source images.
- The REST Images reference documents `response_format: "b64_json"` and `data[].b64_json` for edits.
- The raw `images[]` data URI array from earlier plan drafts is incorrect.

## Plan Implications

- Provider settings must come from `ApiProviderContext`.
- Service tests must assert `image`/`images` object shapes.
- UI must cap Grok reference images at 3 before any network call.
