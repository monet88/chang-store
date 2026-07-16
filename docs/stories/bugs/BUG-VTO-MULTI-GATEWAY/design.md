# Design

## Domain Model

`ModelCapability` owns the supported output image sizes for a Gemini model.
Flash-Lite and Gemini 2.5 Flash expose only `1K`; models without an explicit
size list retain the existing 1K, 2K, and 4K UI options.

## Application Flow

1. Virtual Try-On creates one job per subject image.
2. Each job builds interleaved parts containing one subject and the outfit
   references.
3. `gemini/image.ts` resolves the requested output size against the selected
   model before calling `generateContent`.
4. The UI reads the same capability contract and resets stale resolution state.

## Interface Contract

- Flash-Lite request: `imageConfig.imageSize` is always `1K`.
- A model with `supportsImageSize: false` receives no `imageSize` field.
- Supported models preserve the requested 1K, 2K, or 4K value.

## Data Model

No persistence, schema, or migration changes.

## UI / Platform Impact

The shared resolution selector displays a single disabled 1K control for
fixed-resolution models. Other model controls retain their existing layout.

## Observability

Existing `debugService` error logging remains unchanged. Regression tests
assert the SDK request object before network serialization.

## Alternatives Considered

1. Change Virtual Try-On default to 1K globally. Rejected because it would
   reduce output quality for models that support 2K and 4K.
2. Remove Flash-Lite from the registry. Rejected because the model officially
   supports image editing; only its resolution contract was modeled incorrectly.
3. Fix only the hook. Rejected because the shared service and other features
   could still send invalid sizes.