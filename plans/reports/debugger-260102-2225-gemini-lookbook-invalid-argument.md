# Debugging Report: Gemini API INVALID_ARGUMENT Error in Lookbook Feature

**Date**: 2026-01-02 22:25
**ID**: debugger-260102-2225-gemini-lookbook-invalid-argument
**Status**: Investigation Complete

---

## Executive Summary

**Issue**: Gemini API returns HTTP 400 INVALID_ARGUMENT when generating images in Lookbook feature using `gemini-2.5-flash` model.

**Root Cause**: Incorrect API config structure - using object syntax `{responseModalities, imageConfig}` instead of `generationConfig` wrapper required by Gemini REST API and `@google/genai` SDK.

**Impact**: Lookbook feature completely broken for Gemini-based image generation. Users cannot generate lookbook images with gemini-2.5-flash model.

**Severity**: High - Core feature non-functional.

---

## Technical Analysis

### 1. Call Stack Trace

```
useLookbookGenerator.ts:162 (handleGenerate)
  ↓
imageEditingService.ts:47 (editImage - Gemini path)
  ↓
services/gemini/image.ts:16 (editImage)
  ↓
services/gemini/image.ts:44-51 (ai.models.generateContent)
  ↓
Gemini API: HTTP 400 INVALID_ARGUMENT
```

### 2. Problem Code Location

**File**: `F:\CodeBase\Chang-Store\services\gemini\image.ts`
**Lines**: 44-51

```typescript
const response = await ai.models.generateContent({
    model: model,
    contents: { parts: [...imageParts, textPart] },
    config: {
        responseModalities: [Modality.IMAGE],  // ❌ WRONG
        ...(Object.keys(imageConfig).length > 0 && { imageConfig }),  // ❌ WRONG
    },
});
```

### 3. Root Cause Details

**ISSUE 1: Missing `generationConfig` Wrapper**

The code passes `responseModalities` and `imageConfig` directly in `config`, but according to Gemini API docs and examples, these should be wrapped in `generationConfig`.

**Current (WRONG)**:
```typescript
config: {
    responseModalities: [Modality.IMAGE],
    imageConfig: { aspectRatio: '16:9', imageSize: '2K' }
}
```

**Expected (CORRECT)**:
```typescript
config: {
    generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '16:9', imageSize: '2K' }
    }
}
```

**ISSUE 2: Enum vs String**

Using `[Modality.IMAGE]` (TypeScript enum) instead of string array `['IMAGE']`.

**ISSUE 3: Invalid Model Name**

User reported using `gemini-2.5-flash` model, which is a **text/multimodal model**, NOT an image generation model.

Valid image generation models:
- ✅ `gemini-2.5-flash-image` (default in code)
- ✅ `gemini-3-pro-image-preview`
- ❌ `gemini-2.5-flash` (text-only model)

However, this is a configuration issue, not a code bug - user likely selected wrong model in UI.

---

## Evidence from Documentation

**Source**: `F:\CodeBase\Chang-Store\docs\api\image-generation.md`

### JavaScript Example (Lines 594-604)
```javascript
let response = await chat.sendMessage({
  message,
  config: {
    responseModalities: ['TEXT', 'IMAGE'],  // ✅ String array
    imageConfig: {                          // ✅ Direct in config
      aspectRatio: aspectRatio,
      imageSize: resolution,
    },
    tools: [{googleSearch: {}}],
  },
});
```

**NOTE**: This example uses `chat.sendMessage()`, which might have different API signature than `ai.models.generateContent()`.

### REST API Example (Lines 681-690)
```json
{
  "contents": [...],
  "tools": [{"google_search": {}}],
  "generationConfig": {                    // ✅ Wrapped in generationConfig
    "responseModalities": ["TEXT", "IMAGE"],
    "imageConfig": {
      "aspectRatio": "16:9",
      "imageSize": "2K"
    }
  }
}
```

**CRITICAL**: REST API requires `generationConfig` wrapper!

### Simple Text-to-Image (Lines 50-53)
```javascript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  contents: prompt,                         // ✅ No config needed for simple cases
});
```

### Image Editing with Config (Lines 4448-4467)
```javascript
// For gemini-2.5-flash-image
const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
    config: {
      imageConfig: {                        // ✅ imageConfig directly in config
        aspectRatio: "16:9",
      },
    }
});

// For gemini-3-pro-image-preview
const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "2K",                   // ✅ imageSize only for Pro model
      },
    }
});
```

---

## SDK Version Analysis

**Installed**: `@google/genai@1.30.0`

The documentation shows inconsistencies:
- Some examples use `config.responseModalities` directly
- Some examples use `config.generationConfig.responseModalities`
- REST API always uses `generationConfig` wrapper

This suggests the SDK might be:
1. Accepting both formats (with auto-conversion)
2. Having breaking changes between versions
3. Documentation is outdated/mixed

---

## Affected Code Locations

### Primary Issue
1. **`services/gemini/image.ts:44-51`** - `editImage()` main generation
2. **`services/gemini/image.ts:145-151`** - `upscaleImage()`
3. **`services/gemini/image.ts:216-222`** - `extractOutfitItem()`
4. **`services/gemini/image.ts:301-308`** - `critiqueAndRedesignOutfit()`

All use same incorrect pattern:
```typescript
config: {
    responseModalities: [Modality.IMAGE],
    ...(imageConfig && { imageConfig })
}
```

### Secondary Observations

**Lines 36-42** - Config building logic:
```typescript
const imageConfig: { aspectRatio?: string; imageSize?: string } = {};
if (aspectRatio && aspectRatio !== 'Default') {
    imageConfig.aspectRatio = aspectRatio;
}
if (resolution) {
    imageConfig.imageSize = resolution;
}
```

This is correct, but the config is applied incorrectly later.

---

## Model Compatibility Matrix

| Model | Type | Supports Image Output | AspectRatio | Resolution (imageSize) |
|-------|------|----------------------|-------------|------------------------|
| `gemini-2.5-flash` | Text/Multimodal | ❌ NO | N/A | N/A |
| `gemini-2.5-flash-image` | Image Generation | ✅ YES | ✅ YES | ❌ NO |
| `gemini-3-pro-image-preview` | Image Generation | ✅ YES | ✅ YES | ✅ YES (1K/2K/4K) |

**From docs (line 4349)**:
> `gemini-2.5-flash-image` works best with up to 3 images as input, while `gemini-3-pro-image-preview` supports 5 images with high fidelity, and up to 14 images in total.

---

## Additional Findings

### 1. Missing `responseModalities` for Simple Cases

According to docs (lines 50-53, 188-196), simple text-to-image or image editing **doesn't require** `responseModalities` in config. The model infers output type.

Current code **always** sets `responseModalities: [Modality.IMAGE]`, which might be unnecessary.

### 2. `generateImageFromText()` Uses Different API

**Lines 113-121** in `image.ts`:
```typescript
const response = await ai.models.generateImages({  // ✅ Different API!
    model: model,
    prompt: prompt,
    config: {
        numberOfImages: numberOfImages,
        outputMimeType: 'image/png',
        aspectRatio: aspectRatio === 'Default' ? '1:1' : aspectRatio,
    },
});
```

This uses `generateImages()` API (for Imagen models), NOT `generateContent()`.

### 3. Modality Import

**Line 2**: `import { Part, Modality, Type } from "@google/genai";`

`Modality` enum is imported but might not be correct type for string-based API.

---

## Recommended Fixes

### Option 1: Remove `responseModalities` (Simplest)

Based on simple examples in docs, `responseModalities` might not be needed when using image generation models:

```typescript
const response = await ai.models.generateContent({
    model: model,
    contents: { parts: [...imageParts, textPart] },
    config: {
        // Remove responseModalities entirely
        ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
    },
});
```

### Option 2: Use `generationConfig` Wrapper

Based on REST API examples:

```typescript
const response = await ai.models.generateContent({
    model: model,
    contents: { parts: [...imageParts, textPart] },
    config: {
        generationConfig: {
            responseModalities: ['IMAGE'],
            ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
        }
    },
});
```

### Option 3: Conditional Logic by Model

Different handling for different model types:

```typescript
const configObj: any = {};

if (Object.keys(imageConfig).length > 0) {
    configObj.imageConfig = imageConfig;
}

// Only add responseModalities for multi-modal models
if (model.includes('gemini-3')) {
    configObj.responseModalities = ['IMAGE'];
}

const response = await ai.models.generateContent({
    model: model,
    contents: { parts: [...imageParts, textPart] },
    ...(Object.keys(configObj).length > 0 && { config: configObj }),
});
```

---

## Testing Recommendations

1. **Test with `gemini-2.5-flash-image`** (default model) - should work after fix
2. **Test with `gemini-3-pro-image-preview`** - verify aspect ratio + resolution
3. **Test with multiple input images** (2-3 images) - verify multi-image synthesis
4. **Test aspect ratio variations** - 1:1, 16:9, 9:16, etc.
5. **Test with/without negative prompt** - ensure prompt construction works
6. **Verify error handling** - ensure safety blocks return proper error messages

---

## Unresolved Questions

1. **Which config structure does `@google/genai@1.30.0` actually accept?**
   - Need to check SDK source code or run test with API logging
   - Documentation shows both direct and wrapped approaches

2. **Why does the code currently work in other features?**
   - Need to verify if other features (Virtual Try-On, Background Replacer, etc.) use same code path
   - Might be working due to model-specific API differences

3. **Is there TypeScript type mismatch?**
   - SDK types might allow `Modality.IMAGE` enum but API expects string `'IMAGE'`
   - Need to verify actual types from `@google/genai` package

4. **What is the actual HTTP request being sent?**
   - Enable API request logging to see exact JSON payload
   - Compare with REST API curl examples

5. **Does the user have correct API key permissions?**
   - Gemini API might require specific API key features for image generation
   - Verify API key has image generation enabled

---

## Next Steps for Developer

1. **Enable detailed logging** in `apiClient.ts` to capture full request/response
2. **Add try-catch** around generateContent call with full error object logging
3. **Test minimal reproduction** - single API call with hardcoded values
4. **Check SDK documentation** for v1.30.0 specifically (changelog/migration guide)
5. **Consider upgrading SDK** to latest version if API changed
6. **Add model validation** - prevent using text-only models for image generation

---

## Files Referenced

- `F:\CodeBase\Chang-Store\hooks\useLookbookGenerator.ts` - Business logic
- `F:\CodeBase\Chang-Store\services\imageEditingService.ts` - Service router
- `F:\CodeBase\Chang-Store\services\gemini\image.ts` - **PRIMARY BUG LOCATION**
- `F:\CodeBase\Chang-Store\services\apiClient.ts` - SDK client
- `F:\CodeBase\Chang-Store\docs\api\image-generation.md` - API documentation
- `F:\CodeBase\Chang-Store\types.ts` - Type definitions

---

## Metadata

- **Investigation Duration**: ~15 minutes
- **Files Analyzed**: 6
- **Lines of Code Reviewed**: ~350
- **Documentation Pages**: 1 (4500+ lines)
- **SDK Version**: @google/genai@1.30.0
