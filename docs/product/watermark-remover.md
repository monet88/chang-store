# Watermark Remover

## Purpose

Batch-remove watermarks from images using AI with configurable prompts
and concurrency.

## Behavior

1. User adds images to a processing queue.
2. User configures: model, prompt preset (or custom), concurrency (1-5).
3. User starts batch processing.
4. Each image is processed in parallel up to the concurrency limit.
5. Results show per-item status (pending/processing/completed/error).
6. Failed items can be retried individually with different prompts.
7. Completed results downloadable as ZIP or individual JPEG.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| Model | `DEFAULT_WATERMARK_MODEL` | AI model for processing |
| Prompt preset | `DEFAULT_PROMPT_ID` | Predefined removal prompt |
| Custom prompt | empty | User-written prompt override |
| Concurrency | 1-5 | Parallel processing slots |

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| Images | Yes | One or more watermarked photos |
| Model | No | Override default model |
| Prompt | No | Override default removal prompt |

## Key Files

- `src/components/WatermarkRemover.tsx` — UI
- `src/hooks/useWatermarkRemover.ts` — logic + state
- `src/utils/watermark-prompts.ts` — prompt presets and model config

## Validation Path

- Add images → start processing → watermarks removed
- Retry failed item with different prompt → succeeds
- Download ZIP of all completed results
