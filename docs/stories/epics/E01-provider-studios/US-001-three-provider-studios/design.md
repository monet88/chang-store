# Design

## Domain Model

- `StudioMode`: `gemini`, `grok`, or `gptImage`.
- `ProviderSettings`: API key, base URL, provider id, and validation state owned by `ApiProviderContext`.
- `ProviderResult`: local-only generated image data shaped as `ImageFile[]`.
- `ProviderApiError`: typed non-2xx provider failure with status, optional code, and message.

## Application Flow

1. App starts in Gemini mode and renders the current workspace.
2. Header switch changes `studioMode`.
3. Switching to a provider mode clamps active feature to the provider-supported subset.
4. Provider studio owns its workflow form state and unmounts on studio switch.
5. Provider hook validates prompt/images, reads provider settings from context, calls provider service, and stores results locally.
6. Provider result grid displays local results without Gallery side effects.

## Interface Contract

Grok:

- Generation uses xAI JSON image generation.
- Single-image edit uses `image: { type: "image_url", url }`.
- Multi-image edit uses `images: [{ type: "image_url", url }]`.
- Multi-image editing is capped at 3 source images.
- Service must prove `b64_json` output or fail with a typed unsupported-response error.

GPT Image:

- Generation uses JSON with model `gpt-image-2`.
- Quality values are `low`, `medium`, `high`, and `auto`.
- Edit uses multipart with repeated `image[]` fields.
- Browser code must not manually set multipart `Content-Type`.
- Product cap is 10 source images even if provider docs allow more.

## Data Model

Provider API key and base URL overrides persist through the existing `ApiProviderContext` localStorage guard pattern. Form state and generated results are not persisted.

## UI / Platform Impact

- Header gains a studio switcher.
- Sidebar shows nine Gemini features in Gemini mode and five provider features in provider modes.
- Utility dock hides Gallery in provider modes while keeping Settings and Prompt Library.
- Provider settings panel is shared, but workflow UI remains provider-specific.

## Observability

Provider services should surface typed errors to hooks so UI can show user-facing error messages without leaking secrets. Tests should assert request contracts and non-Gemini isolation.

## Alternatives Considered

- Standalone provider settings service: rejected because project rules require provider config and API keys to come from `ApiProviderContext`.
- Shared workflow payload builder: rejected to keep provider contracts explicit and avoid premature abstraction.
- Backend proxy in v1: deferred because the accepted plan allows browser-exposed provider keys for v1 with documented risk.
