# Open Issues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve all currently open bd issues (cs-d3s, cs-d3s.5, cs-d3s.5.2, cs-aa1 children) and restore a clean `npx tsc --noEmit` baseline in the worktree.

**Architecture:** Changes are isolated to TypeScript fixes and test/config updates. No feature expansion. Manual UI smoke test validates Local provider in the UI without touching runtime architecture.

**Tech Stack:** React 19 + Vite, Vitest, TypeScript, bd

---

### Task 0: Ensure localProviderService exists and compiles (baseline restore)

**Files:**
- Create (if missing): `services/localProviderService.ts`
- Modify (if needed for TS): `services/localProviderService.ts`
- Test: `__tests__/services/localProviderService.test.ts`

**Step 1: Verify file exists (failing check if missing)**

Run:
```
powershell -NoProfile -Command "Test-Path -LiteralPath 'services/localProviderService.ts'"
```
Expected: `True` (if `False`, create the file in Step 3).

**Step 2: Run targeted test to confirm baseline failure**

Run:
```
npm test -- __tests__/services/localProviderService.test.ts
```
Expected: FAIL if file missing; if already present, proceed to Step 3.

**Step 3: Add file (if missing) with exact content**

Create `services/localProviderService.ts` with:
```ts
import { ImageFile } from '../types';

export interface LocalProviderConfig {
  baseUrl: string;
  apiKey?: string | null;
}

const DEFAULT_IMAGE_SIZE = '1024x1024';
const DEFAULT_ASPECT_RATIO = '1:1';

type InlineData = {
  data?: string;
  mimeType?: string;
  mime_type?: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: InlineData;
  inline_data?: InlineData;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildGeminiUrl(baseUrl: string, model: string, action: 'generateContent', apiKey?: string | null): string {
  const trimmed = normalizeBaseUrl(baseUrl);
  const baseWithVersion = trimmed.endsWith('/v1beta') ? trimmed : `${trimmed}/v1beta`;
  const url = `${baseWithVersion}/models/${model}:${action}`;
  if (!apiKey) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}key=${encodeURIComponent(apiKey)}`;
}

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('error.api.localProviderFailed');
  }

  const text = await response.text();
  try {
    return text ? JSON.parse(text) : ({} as T);
  } catch {
    throw new Error('error.api.invalidResponse');
  }
}

function normalizeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'error.unknown';
  if (message.startsWith('error.')) {
    return new Error(message);
  }
  return new Error('error.api.localProviderFailed');
}

function normalizeBase64(base64: string): string {
  return base64.includes(',') ? base64.split(',')[1] : base64;
}

function extractParts(data: GeminiResponse): GeminiPart[] {
  return data?.candidates?.[0]?.content?.parts ?? [];
}

function extractText(parts: GeminiPart[]): string | null {
  const text = parts.map((part) => part.text).filter(Boolean).join(' ').trim();
  return text || null;
}

function extractInlineImage(parts: GeminiPart[]): { data: string; mimeType: string } | null {
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) {
      return {
        data: inline.data,
        mimeType: inline.mimeType ?? inline.mime_type ?? 'image/png',
      };
    }
  }
  return null;
}

function mapSizeToAspectRatio(size: string): string {
  const [widthStr, heightStr] = size.split('x');
  const width = Number(widthStr);
  const height = Number(heightStr);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_ASPECT_RATIO;
  }
  const ratio = width / height;
  const candidates: Array<{ ratio: number; value: string }> = [
    { ratio: 1, value: '1:1' },
    { ratio: 9 / 16, value: '9:16' },
    { ratio: 16 / 9, value: '16:9' },
    { ratio: 4 / 3, value: '4:3' },
    { ratio: 3 / 4, value: '3:4' },
    { ratio: 2 / 3, value: '2:3' },
    { ratio: 3 / 2, value: '3:2' },
    { ratio: 4 / 5, value: '4:5' },
    { ratio: 5 / 4, value: '5:4' },
    { ratio: 21 / 9, value: '21:9' },
  ];

  let closest = candidates[0];
  let minDiff = Math.abs(ratio - closest.ratio);
  for (const candidate of candidates) {
    const diff = Math.abs(ratio - candidate.ratio);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candidate;
    }
  }
  return closest.value;
}

export async function generateTextLocal(
  prompt: string,
  model: string,
  config: LocalProviderConfig
): Promise<string> {
  try {
    if (!config.baseUrl) {
      throw new Error('error.api.localProviderFailed');
    }
    const url = buildGeminiUrl(config.baseUrl, model, 'generateContent', config.apiKey ?? null);
    const data = await postJson<GeminiResponse>(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = extractText(extractParts(data));
    if (!text) {
      throw new Error('error.api.noText');
    }
    return text;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function generateTextFromImageLocal(
  image: ImageFile,
  prompt: string,
  model: string,
  config: LocalProviderConfig
): Promise<string> {
  try {
    if (!config.baseUrl) {
      throw new Error('error.api.localProviderFailed');
    }
    const url = buildGeminiUrl(config.baseUrl, model, 'generateContent', config.apiKey ?? null);
    const data = await postJson<GeminiResponse>(url, {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { data: normalizeBase64(image.base64), mimeType: image.mimeType } },
        ],
      }],
    });

    const text = extractText(extractParts(data));
    if (!text) {
      throw new Error('error.api.noText');
    }
    return text;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function generateImageLocal(
  prompt: string,
  model: string,
  config: LocalProviderConfig,
  size: string = DEFAULT_IMAGE_SIZE
): Promise<ImageFile> {
  try {
    if (!config.baseUrl) {
      throw new Error('error.api.localProviderFailed');
    }
    const url = buildGeminiUrl(config.baseUrl, model, 'generateContent', config.apiKey ?? null);
    const data = await postJson<GeminiResponse>(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: mapSizeToAspectRatio(size) },
      },
    });

    const inlineImage = extractInlineImage(extractParts(data));
    if (!inlineImage?.data) {
      throw new Error('error.api.noImage');
    }
    return { base64: inlineImage.data, mimeType: inlineImage.mimeType || 'image/png' };
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function editImageLocal(
  image: ImageFile,
  prompt: string,
  model: string,
  config: LocalProviderConfig,
  size: string = DEFAULT_IMAGE_SIZE
): Promise<ImageFile> {
  try {
    if (!config.baseUrl) {
      throw new Error('error.api.localProviderFailed');
    }
    const url = buildGeminiUrl(config.baseUrl, model, 'generateContent', config.apiKey ?? null);
    const data = await postJson<GeminiResponse>(url, {
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: normalizeBase64(image.base64), mimeType: image.mimeType } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: mapSizeToAspectRatio(size) },
      },
    });

    const inlineImage = extractInlineImage(extractParts(data));
    if (!inlineImage?.data) {
      throw new Error('error.api.noImage');
    }
    return { base64: inlineImage.data, mimeType: inlineImage.mimeType || 'image/png' };
  } catch (error) {
    throw normalizeError(error);
  }
}
```

**Step 4: Run targeted test**

Run:
```
npm test -- __tests__/services/localProviderService.test.ts
```
Expected: PASS.

**Step 5: Commit**

```
git add services/localProviderService.ts
 git commit -m "fix: add local provider service"
```

---

### Task 1: Fix cs-nxp (AIVIDEOAUTO_CONFIG mock fields)

**Files:**
- Modify: `__tests__/services/imageEditingService.test.ts`
- Test: `npx tsc --noEmit`

**Step 1: Run tsc to see current error**

Run:
```
npx tsc --noEmit
```
Expected: FAIL if missing AIVIDEOAUTO fields.

**Step 2: Update mock config**

Ensure models include required fields:
```ts
const AIVIDEOAUTO_CONFIG = {
  aivideoautoAccessToken: 'test-token-123',
  onStatusUpdate: vi.fn(),
  aivideoautoVideoModels: [
    { id_base: 'video-model-1', model: 'video-model', name: 'Video Model 1', server: 'test-server', price: 0, startText: true, startImage: true },
  ],
  aivideoautoImageModels: [
    { id_base: 'image-model-1', model: 'image-model', name: 'Image Model 1', server: 'test-server', price: 0, startText: true, startImage: true },
  ],
};
```

**Step 3: Re-run tsc**

Run:
```
npx tsc --noEmit
```
Expected: PASS or next error only.

**Step 4: Commit**

```
git add __tests__/services/imageEditingService.test.ts
 git commit -m "fix(test): complete aivideoauto mock fields"
```

---

### Task 2: Fix cs-0vu (Promise resolve type in lookbook test)

**Files:**
- Modify: `__tests__/hooks/useLookbookGenerator.test.tsx`
- Test: `npx tsc --noEmit`

**Step 1: Run tsc to confirm error**

Run:
```
npx tsc --noEmit
```
Expected: FAIL if `unknown[]` not assignable to `ImageFile[]`.

**Step 2: Add explicit promise type**

Use typed promise or typed resolve:
```ts
let resolvePromise: (value: ImageFile[]) => void;
vi.mocked(editImage).mockImplementation(
  () => new Promise<ImageFile[]>((resolve) => { resolvePromise = resolve; })
);
```

**Step 3: Re-run tsc**

Run:
```
npx tsc --noEmit
```
Expected: PASS or next error only.

**Step 4: Commit**

```
git add __tests__/hooks/useLookbookGenerator.test.tsx
 git commit -m "fix(test): type lookbook promise resolve"
```

---

### Task 3: Fix cs-865 (Feature.Inpainting enum usage)

**Files:**
- Modify (if needed): `components/AIEditor.tsx`
- Test: `npx tsc --noEmit`

**Step 1: Run tsc to confirm error**

Run:
```
npx tsc --noEmit
```
Expected: FAIL if `Feature.Inpainting` referenced.

**Step 2: Replace with existing enum**

Ensure AI editor uses existing enum:
```ts
const { imageEditModel } = getModelsForFeature(Feature.AIEditor);
```

**Step 3: Re-run tsc**

Run:
```
npx tsc --noEmit
```
Expected: PASS or next error only.

**Step 4: Commit**

```
git add components/AIEditor.tsx
 git commit -m "fix: align AIEditor feature enum"
```

---

### Task 4: Fix cs-rqa (React import in useCanvasDrawing)

**Files:**
- Modify (if needed): `hooks/useCanvasDrawing.ts`
- Test: `npx tsc --noEmit`

**Step 1: Run tsc to confirm error**

Run:
```
npx tsc --noEmit
```
Expected: FAIL if `React` namespace is referenced.

**Step 2: Add React import**

At top of file:
```ts
import React from 'react';
```

**Step 3: Re-run tsc**

Run:
```
npx tsc --noEmit
```
Expected: PASS or next error only.

**Step 4: Commit**

```
git add hooks/useCanvasDrawing.ts
 git commit -m "fix: add React import for canvas hook"
```

---

### Task 5: Fix cs-gvg (remove invalid fs.cachedChecks)

**Files:**
- Modify (if needed): `vite.config.ts`
- Test: `npx tsc --noEmit`

**Step 1: Run tsc to confirm error**

Run:
```
npx tsc --noEmit
```
Expected: FAIL if `fs.cachedChecks` present.

**Step 2: Remove invalid option**

Ensure `server.fs.cachedChecks` is not present.

**Step 3: Re-run tsc**

Run:
```
npx tsc --noEmit
```
Expected: PASS or next error only.

**Step 4: Commit**

```
git add vite.config.ts
 git commit -m "fix: remove invalid vite fs option"
```

---

### Task 6: Final TypeScript verification + close cs-aa1

**Files:**
- Test only

**Step 1: Run full TypeScript check**

Run:
```
npx tsc --noEmit
```
Expected: PASS.

**Step 2: Update bd status**

Mark cs-nxp, cs-0vu, cs-865, cs-rqa, cs-gvg as closed. Then close cs-aa1 with reason "tsc clean".

---

### Task 7: Manual UI smoke test (cs-d3s.5.2)

**Files:**
- Manual run

**Step 1: Start dev server**

Run:
```
npm run dev
```
Expected: Vite server at `http://localhost:3000`.

**Step 2: Validate Local provider text generation**

- Open Settings, select Local provider.
- Base URL: local endpoint (e.g. `https://proxypal.azacc.store` or user-provided).
- API key: `proxypal-local`.
- Choose a local Gemini-style text model.
- Submit a short prompt ("Hello" -> expect response).

**Step 3: Validate Local provider image generation**

- Navigate to an image generation feature.
- Choose a local Gemini-style image model.
- Generate an image with a short prompt.
- Verify image renders.

**Step 4: Record evidence**

Capture screenshot(s) or note observed result in `plans/reports/` if required.

**Step 5: Update bd status**

Close cs-d3s.5.2, then close cs-d3s.5 and cs-d3s.

---

### Task 8: Final tests + sync

**Files:**
- Test only

**Step 1: Run full test suite**

Run:
```
npm test
```
Expected: PASS.

**Step 2: Sync beads**

Run:
```
bd sync
```

---

# End of Plan
