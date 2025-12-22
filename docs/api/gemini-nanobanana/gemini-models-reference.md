# Gemini Models Reference

Quick reference for all Gemini API models available in Chang-Store.

## Text Generation Models

| Model ID | Name | I/O | Context | Thinking | Best For |
|----------|------|-----|---------|----------|----------|
| `gemini-3-pro-preview` | Gemini 3 Pro | Text/Image/Video/Audio → Text | 1M | ✓ | Complex reasoning, agentic tasks |
| `gemini-3-flash-preview` | Gemini 3 Flash | Text/Image/Video/Audio → Text | 1M | ✓ | Speed + intelligence, search grounding |
| `gemini-2.5-pro` | Gemini 2.5 Pro | Text/Image/Video/Audio → Text | 1M | ✓ | Complex analysis |
| `gemini-2.5-flash` | Gemini 2.5 Flash | Text/Image/Video/Audio → Text | 1M | ✓ | Fast text tasks |

## Image Generation/Editing Models

| Model ID | Name | I/O | Features |
|----------|------|-----|----------|
| `gemini-3-pro-image-preview` | Gemini 3 Pro Image | Image+Text → Image+Text | Image gen, editing, thinking |
| `gemini-2.5-flash-image` | Gemini 2.5 Flash Image (Nano Banana) | Image+Text → Image+Text | Text-to-image, editing, multi-turn, text rendering |

## Imagen Models (Specialized Image Gen)

| Model ID | Name | Output | Features |
|----------|------|--------|----------|
| `imagen-4.0-ultra-generate-001` | Imagen 4 Ultra | 1 image | Best quality, 1K/2K resolution |
| `imagen-4.0-generate-001` | Imagen 4 | 1-4 images | Standard quality |
| `imagen-4.0-fast-generate-001` | Imagen 4 Fast | 1-4 images | Speed optimized |

## Video Generation Models (Veo)

| Model ID | Name | Resolution | Duration | Audio |
|----------|------|------------|----------|-------|
| `veo-3.1-generate-preview` | Veo 3.1 | 720p/1080p | 4-8s | ✓ Native |
| `veo-3.1-fast-generate-preview` | Veo 3.1 Fast | 720p/1080p | 4-8s | ✓ Native |
| `veo-3.0-generate-001` | Veo 3 | 720p/1080p | 4-8s | ✓ Native |
| `veo-3.0-fast-generate-001` | Veo 3 Fast | 720p/1080p | 4-8s | ✓ Native |

## Model Selection Guidelines

### For Image Editing (in SettingsModal)
- **Gemini 3 Pro Image (Preview)**: Latest, supports thinking, best quality
- **Gemini 2.5 Flash Image**: Stable, fast, multi-turn editing

### For Image Generation
- **Imagen 4 Ultra**: Best quality, single image
- **Imagen 4**: Balanced quality/speed, up to 4 images
- **Imagen 4 Fast**: Quick generation, lower quality

### For Video Generation
- **Veo 3.1**: Latest, video extension, reference images
- **Veo 3.1 Fast**: Speed optimized
- **Veo 3/3 Fast**: Stable versions

### For Text/Analysis (hardcoded in services)
- Complex reasoning: `gemini-3-pro-preview` or `gemini-2.5-pro`
- Fast tasks: `gemini-3-flash-preview` or `gemini-2.5-flash`

## Gemini 3 vs 2.5 Key Differences

| Feature | Gemini 3 | Gemini 2.5 |
|---------|----------|------------|
| Maps Grounding | ❌ | ✓ (stable) |
| Live API | ❌ | ✓ (Flash) |
| Agentic Tasks | Best | Good |
| Search Grounding | ✓ | ✓ |

## API Configuration

```typescript
// Text generation - uses model from settings, passed to service functions
const model = textGenerateModel; // e.g., 'gemini-3-pro-preview'
await generateText(prompt, model);
await generateStylePromptFromImage(image, model);
await analyzeScene(image, model);

// Image editing - uses model from settings
const model = imageEditModel; // e.g., 'gemini-3-pro-image-preview'

// Video generation - uses model from settings or default
const model = videoGenerateModel || 'veo-3.1-fast-generate-preview';

// Video prompts - uses model from settings
await generateVideoContinuitySequence({ ...params, model: textGenerateModel });
await generateVideoPromptVariations({ ...params, model: textGenerateModel });
```

---

*Last updated: 2025-12-22*
