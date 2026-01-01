---
topic: "Gemini API Output Resolution Parameter"
date: 2026-01-01
status: complete
confidence: high
mode: quick
---

# Quick Research: Gemini API Output Resolution

## TL;DR

Gemini 3 Pro Image API **HAS** dedicated parameters for resolution and aspect ratio via `generationConfig.imageConfig` object.

## Key Findings

- **Gemini 3 Pro Image**: Supports `imageConfig` in `generationConfig`
- **Parameters available**:
  - `aspectRatio`: "1:1", "3:4", "9:16", "16:9", etc.
  - `imageSize`: "1K", "2K", "4K"
- **Example API call**:
  ```json
  "generationConfig": {
    "imageConfig": {
      "aspectRatio": "16:9",
      "imageSize": "4K"
    }
  }
  ```

## Recommended Approach

For Chang-Store project:
1. Update `@google/genai` SDK call to include `generationConfig.imageConfig`
2. Pass `aspectRatio` and `imageSize` as API params instead of prompt text
3. More reliable than prompt-based approach

## Sources

- [Gemini 3 Pro Image API](https://ai.google.dev/gemini-api/docs/image-generation) - Official docs with `imageConfig` example
