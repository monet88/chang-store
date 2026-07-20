# Multi-Person Virtual Try-On Gateway Validation

Story: `BUG-VTO-MULTI-GATEWAY`
Lane: high-risk

## Current Behavior

Virtual Try-On defaults to 2K output. When `gemini-3.1-flash-lite-image` is
selected, each subject job sends `imageConfig.imageSize: "2K"` through the
configured Vertex gateway. Flash-Lite supports image editing and up to 14 input
images, but its only supported output resolution is 1K, so upstream rejects the
request with `VALIDATION_FAILED`.

The three uploaded people images are separate jobs with bounded concurrency;
each request contains one subject image and the shared outfit image.

## Target Behavior

- Flash-Lite edit and upscale requests use 1K even when stale UI state requests
  2K or 4K.
- Models that do not accept `imageSize` omit the field.
- The shared resolution selector exposes only sizes supported by the selected
  model and resets stale unsupported state.
- Three subject images plus one outfit complete as three valid try-on jobs.

## Affected Users

- Gemini studio users selecting Nano Banana 2 Lite for Virtual Try-On.
- Users switching between image models with different resolution support.

## Affected Product Docs

- `docs/product/try-on.md`
- `docs/ARCHITECTURE.md`

## Non-Goals

- Changing Virtual Try-On batch concurrency.
- Changing the interleaved subject/outfit prompt structure.
- Changing gateway routes or authentication.