# Local Model Feature Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Plan and execute tests for local Gemini-style models so future runs only require changing base URL and API key.

**Architecture:** Use a gemini-style REST smoke test script for automated coverage, plus a manual UI checklist for key flows. Focus on text-to-image, image-edit, and image-understanding paths that local models support.

**Tech Stack:** Node.js scripts, Vite UI, Vitest, Local provider (Gemini-style `/v1beta/models/*:generateContent`).

---

## Feature → Local API Mapping (Gemini-style)

Legend: **Local API type** = how local provider is called.

| Feature | Local API type | Local support | Notes |
|---|---|---|---|
| TryOn (Virtual Try-On) | image-edit | Yes | Uses `editImage`. Upscale uses Gemini cloud. |
| Lookbook | image-edit + image-to-text | Partial | Edits + clothing description use local. Refinement chat + upscale are Gemini. |
| Background Replacer | image-edit + image-to-text | Partial | Edit + description use local. Upscale is Gemini. |
| Pose Changer | image-edit + image-to-text | Partial | Edit + pose description use local. Upscale is Gemini. |
| Photo Album | image-edit | Yes | Uses `editImage`. |
| Outfit Analysis | image-to-text | Partial | `analyzeOutfit` local. Redesign/extract use Gemini. |
| Relight | image-edit | Yes | Uses `editImage`. |
| Upscale | image-edit | No (local) | `upscaleImage` calls Gemini cloud for non-AIVideoAuto. |
| Image Editor | image-edit + text-to-image | Yes | Uses `editImage` + `generateImage`. |
| AI Editor (Inpainting) | image-edit | Yes | Uses `editImage` (if canvas mask path is wired). |
| Watermark Remover | image-edit | Yes | Uses `editImage`. |
| Swap Face | - | Removed | Feature removed from UI; do not test. |
| Video / GRWM Video | video | No (local) | Uses AIVideoAuto or Gemini video. |

---

### Task 1: Map feature → local service/model (gemini-style)

**Files:**
- Modify: `docs/plans/2026-01-20-local-model-feature-tests.md`
- Read: `hooks/*`, `services/imageEditingService.ts`, `services/textService.ts`, `services/localProviderService.ts`

**Step 1: Capture mapping from hooks to API calls**
- Expected: mapping table above is accurate and complete.

**Step 2: Update plan if new features or calls are found**

**Step 3: Commit**
```bash
git add docs/plans/2026-01-20-local-model-feature-tests.md
git commit -m "docs: map local feature coverage for gemini-style tests"
```

---

### Task 2: Prepare minimal test assets

**Files:**
- Modify: `docs/plans/2026-01-20-local-model-feature-tests.md`
- Optional: `__tests__/images-test/`

**Step 1: Inventory available assets**
- Existing:
  - `__tests__/images-test/D15-2.jpg`
  - `__tests__/images-test/D15-3.jpg`
  - `__tests__/images-test/D15-4.jpg`
  - `design-example.jpg`
  - `image.jpg`

**Step 2: Map assets to features**
- Suggested usage:
  - `D15-2.jpg`: general image-edit (lookbook, background, relight, watermark).
  - `D15-3.jpg`: face/subject (pose, relight variations).
  - `D15-4.jpg`: secondary angle (image editor, try-on).
  - `design-example.jpg`: backup for text-to-image comparison.
  - `image.jpg`: backup for background/pose.
- If any feature needs a specialized input, add a new asset.

**Step 3: Commit (only if new assets are added)**
```bash
git add __tests__/images-test
git commit -m "test: add local feature smoke test assets"
```

---

### Task 3: Create per-feature smoke test (gemini-style)

**Files:**
- Create: `scripts/local-feature-smoke-test.mjs`
- Modify: `package.json` (add script)
- Test: run `node scripts/local-feature-smoke-test.mjs`

**Step 1: Write stub script (fail fast)**
- Output: print TODO and exit 1.

**Step 2: Run stub to verify failure**
```bash
LOCAL_PROVIDER_URL="http://localhost:8317" \
LOCAL_PROVIDER_API_KEY="proxypal-local" \
node scripts/local-feature-smoke-test.mjs
```
Expected: Exit code != 0.

**Step 3: Implement feature smoke tests**
- Lookbook: image-edit with clothing image.
- Background Replacer: image-edit with subject image.
- Pose Changer: image-edit with subject + pose prompt.
- Outfit Analysis: image-to-text JSON prompt (validate parse).
- Relight: image-edit.
- Watermark Remover: image-edit.
- Image Editor: text-to-image + image-edit.

**Step 4: Run tests to verify PASS**
```bash
LOCAL_PROVIDER_URL="http://localhost:8317" \
LOCAL_PROVIDER_API_KEY="proxypal-local" \
LOCAL_SMOKE_SAVE_IMAGES="true" \
node scripts/local-feature-smoke-test.mjs
```
Expected: PASS per feature + saved outputs.

**Step 5: Commit**
```bash
git add scripts/local-feature-smoke-test.mjs package.json
git commit -m "test: add gemini-style feature smoke tests for local models"
```

---

### Task 4: Extend unit tests for imageSize

**Files:**
- Modify: `__tests__/services/localProviderService.test.ts`

**Step 1: Add test for imageConfig.imageSize**
- Expected: request body includes `imageSize: "1K" | "2K" | "4K"`.

**Step 2: Run test file**
```bash
npm run test -- __tests__/services/localProviderService.test.ts
```
Expected: PASS.

**Step 3: Commit**
```bash
git add __tests__/services/localProviderService.test.ts
git commit -m "test: cover gemini-style imageSize in local provider"
```

---

### Task 5: Manual UI checklist (local model)

**Files:**
- Modify: `docs/plans/2026-01-20-local-model-feature-tests.md`

**Step 1: Add UI checklist**
- Lookbook AI
- Background Replacer
- Pose Changer
- Outfit Analysis
- Relight
- Watermark Remover
- Image Editor (edit + refine)
- Try-On
- Photo Album

**Step 2: Manual run**
- Set Settings → Local Provider base URL + key.
- Select local models.
- Execute one flow per feature and save outputs.

**Step 3: Commit**
```bash
git add docs/plans/2026-01-20-local-model-feature-tests.md
git commit -m "docs: add local model UI test checklist"
```

---

### Task 6: Report test results

**Files:**
- Create: `plans/reports/2026-01-20-local-model-feature-tests.md`

**Step 1: Record PASS/FAIL**
- Include output image paths or logs per feature.

**Step 2: Commit**
```bash
git add plans/reports/2026-01-20-local-model-feature-tests.md
git commit -m "docs: report local model feature tests"
```

---

Plan complete and saved to `docs/plans/2026-01-20-local-model-feature-tests.md`.
