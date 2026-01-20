# Local Model Feature Test Report (2026-01-20)

**Local provider:** `https://proxypal.azacc.store`  
**API key:** `<LOCAL_PROVIDER_API_KEY>`  
**Models:** `gemini-3-pro-preview` (text), `gemini-3-pro-image-preview` (image)

## Automated Smoke Tests (gemini-style)

Command:
```bash
LOCAL_PROVIDER_URL="https://proxypal.azacc.store" \
LOCAL_PROVIDER_API_KEY="<LOCAL_PROVIDER_API_KEY>" \
LOCAL_SMOKE_SAVE_IMAGES="true" \
LOCAL_SMOKE_OUTPUT_DIR="scripts/local-feature-smoke-output-proxypal" \
LOCAL_SMOKE_IMAGE="__tests__/images-test/D15-2.jpg" \
LOCAL_SMOKE_FACE_IMAGE="__tests__/images-test/D15-3.jpg" \
LOCAL_SMOKE_ALT_IMAGE="__tests__/images-test/D15-4.jpg" \
npm run test:local-features
```

Results: **PASS**

Outputs:
- `scripts/local-feature-smoke-output-proxypal/lookbook.png`
- `scripts/local-feature-smoke-output-proxypal/background-replacer.png`
- `scripts/local-feature-smoke-output-proxypal/pose-changer.png`
- `scripts/local-feature-smoke-output-proxypal/relight.png`
- `scripts/local-feature-smoke-output-proxypal/watermark-remover.png`
- `scripts/local-feature-smoke-output-proxypal/try-on.png`
- `scripts/local-feature-smoke-output-proxypal/photo-album.png`
- `scripts/local-feature-smoke-output-proxypal/image-editor-t2i.png`
- `scripts/local-feature-smoke-output-proxypal/image-editor-edit.png`
- `scripts/local-feature-smoke-output-proxypal/outfit-analysis.json`

## Ratio + Size Validation (local)

Command (sample):
```bash
LOCAL_PROVIDER_URL="http://localhost:8317" \
LOCAL_PROVIDER_API_KEY="<LOCAL_PROVIDER_API_KEY>" \
LOCAL_IMAGE_MODEL_ID="gemini-3-pro-image-preview" \
node -e "<ratio+size test script>"
```

Results:
- Ratios: **PASS** for `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `2:3`, `3:2`, `4:5`, `5:4`, `21:9`
- Sizes: **PASS** for `1K`, `2K`, `4K`

## Manual UI Checklist

- Lookbook AI: pending
- Background Replacer: pending
- Pose Changer: pending
- Outfit Analysis: pending
- Relight: pending
- Watermark Remover: pending
- Image Editor (edit + refine): pending
- Try-On: pending
- Photo Album: pending
