# GPT Image 2 API Planning Notes

Status: planning reference for `plans/260530-1351-three-provider-studios/`. The app runtime is still Gemini-only until the provider studio implementation lands.

## Contract Source

- OpenAI image generation guide: `https://developers.openai.com/api/docs/guides/image-generation`
- OpenAI Images API reference: `https://developers.openai.com/api/reference/resources/images`

Recheck these official docs immediately before implementation.

## Authentication

- Base URL: `https://api.openai.com/v1`
- Header: `Authorization: Bearer $OPENAI_API_KEY`
- Do not commit real API keys or local proxy tokens.

## Generation

Endpoint: `POST /v1/images/generations`

```json
{
  "model": "gpt-image-2",
  "prompt": "A studio fashion product photo",
  "size": "1024x1024",
  "quality": "high"
}
```

Supported quality values for this plan:

- `low`
- `medium`
- `high`
- `auto`

Supported UI size values for this plan:

- `auto`
- `1024x1024`
- `1536x1024`
- `1024x1536`

## Editing

Endpoint: `POST /v1/images/edits`

Raw multipart contract:

```ts
const form = new FormData();
form.append('model', 'gpt-image-2');
form.append('prompt', prompt);
form.append('size', selectedSize);
form.append('quality', selectedQuality);
form.append('image[]', blob, filename);
form.append('image[]', secondBlob, secondFilename);
```

Notes:

- Do not manually set the multipart `Content-Type`; the browser must add the boundary.
- OpenAI docs support up to 16 source images for image edits. The product plan caps this at 10 to avoid timeout and UX overload.
- Earlier plan drafts using `standard`/`hd` quality values or repeated `image` fields are superseded.

## Plan Implications

- Provider settings must come from `ApiProviderContext`.
- Service tests must assert repeated `image[]` fields.
- UI must expose only `low`, `medium`, `high`, and `auto` quality values.
