import fs from 'node:fs';
import path from 'node:path';
import { LOCAL_TEXT_MODELS, LOCAL_IMAGE_MODELS } from '../utils/localModels.data.js';

const baseUrl = (process.env.LOCAL_PROVIDER_URL || 'http://localhost:8317').replace(/\/+$/, '');
const apiKey = process.env.LOCAL_PROVIDER_API_KEY || '';
const saveImages = process.env.LOCAL_SMOKE_SAVE_IMAGES !== 'false';
const outputDir = process.env.LOCAL_SMOKE_OUTPUT_DIR || 'scripts/local-feature-smoke-output';

const imageModel = process.env.LOCAL_IMAGE_MODEL_ID || LOCAL_IMAGE_MODELS[0]?.id;
const textModel = process.env.LOCAL_TEXT_MODEL_ID || LOCAL_TEXT_MODELS[0]?.id;

const defaultImage = process.env.LOCAL_SMOKE_IMAGE || '__tests__/images-test/D15-2.jpg';
const faceImage = process.env.LOCAL_SMOKE_FACE_IMAGE || '__tests__/images-test/D15-3.jpg';
const altImage = process.env.LOCAL_SMOKE_ALT_IMAGE || '__tests__/images-test/D15-4.jpg';

if (!imageModel || !textModel) {
  console.error('Missing LOCAL_IMAGE_MODEL_ID or LOCAL_TEXT_MODEL_ID');
  process.exit(1);
}

const withKey = (url) => (apiKey ? `${url}?key=${encodeURIComponent(apiKey)}` : url);
const toUrl = (modelId) => {
  const baseWithVersion = baseUrl.endsWith('/v1beta') ? baseUrl : `${baseUrl}/v1beta`;
  return withKey(`${baseWithVersion}/models/${modelId}:generateContent`);
};

const resolvedOutputDir = path.resolve(outputDir);
if (saveImages) {
  fs.mkdirSync(resolvedOutputDir, { recursive: true });
}

async function requestJson(url, body) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    data,
    durationMs: Date.now() - startedAt,
  };
}

function readImageBase64(imagePath) {
  const absPath = path.resolve(imagePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Image not found: ${absPath}`);
  }
  const buffer = fs.readFileSync(absPath);
  const mimeType = absPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return { data: buffer.toString('base64'), mimeType, absPath };
}

function extractInlineImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.find((part) => part?.inlineData?.data);
}

function writeImage(base64, fileName) {
  if (!saveImages) return;
  const filePath = path.join(resolvedOutputDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  console.log(`Saved image: ${filePath}`);
}

function parseJsonFromText(text) {
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  return JSON.parse(clean);
}

async function runImageEditTest(name, imagePath, prompt) {
  const { data, mimeType, absPath } = readImageBase64(imagePath);
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { data, mimeType } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '1:1' },
    },
  };

  const url = toUrl(imageModel);
  const result = await requestJson(url, payload);
  if (!result.ok) {
    const message = result.data?.error?.message || `${result.status} ${result.statusText}`;
    throw new Error(`${name} failed: ${message}`);
  }
  const imagePart = extractInlineImage(result.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(`${name} failed: missing image bytes`);
  }
  console.log(`PASS ${name} (${imagePart.inlineData.data.length} chars base64, ${result.durationMs}ms) [input: ${absPath}]`);
  writeImage(imagePart.inlineData.data, `${name}.png`);
}

async function runTextToImageTest(name, prompt) {
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '1:1' },
    },
  };
  const url = toUrl(imageModel);
  const result = await requestJson(url, payload);
  if (!result.ok) {
    const message = result.data?.error?.message || `${result.status} ${result.statusText}`;
    throw new Error(`${name} failed: ${message}`);
  }
  const imagePart = extractInlineImage(result.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(`${name} failed: missing image bytes`);
  }
  console.log(`PASS ${name} (${imagePart.inlineData.data.length} chars base64, ${result.durationMs}ms)`);
  writeImage(imagePart.inlineData.data, `${name}.png`);
}

async function runImageToTextTest(name, imagePath, prompt) {
  const { data, mimeType, absPath } = readImageBase64(imagePath);
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { data, mimeType } },
      ],
    }],
  };
  const url = toUrl(textModel);
  const result = await requestJson(url, payload);
  if (!result.ok) {
    const message = result.data?.error?.message || `${result.status} ${result.statusText}`;
    throw new Error(`${name} failed: ${message}`);
  }
  const parts = result.data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text).filter(Boolean).join(' ').trim();
  if (!text) {
    throw new Error(`${name} failed: missing text response`);
  }
  const parsed = parseJsonFromText(text);
  if (!Array.isArray(parsed)) {
    throw new Error(`${name} failed: expected JSON array`);
  }
  console.log(`PASS ${name} (${parsed.length} items, ${result.durationMs}ms) [input: ${absPath}]`);
  if (saveImages) {
    const filePath = path.join(resolvedOutputDir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2));
    console.log(`Saved JSON: ${filePath}`);
  }
}

async function run() {
  console.log(`Local provider base URL: ${baseUrl}`);
  console.log(`Image model: ${imageModel}`);
  console.log(`Text model: ${textModel}`);
  console.log(`Save outputs: ${saveImages ? 'on' : 'off'}`);
  if (saveImages) {
    console.log(`Output dir: ${resolvedOutputDir}`);
  }

  const promptBase = 'Generate a clean, high-end fashion lookbook product shot on a neutral studio background with soft, diffused lighting.';

  const tests = [
    { name: 'lookbook', fn: () => runImageEditTest('lookbook', defaultImage, `${promptBase} Full-body outfit.`) },
    { name: 'background-replacer', fn: () => runImageEditTest('background-replacer', defaultImage, `${promptBase} Replace background with a bright minimalist studio.`) },
    { name: 'pose-changer', fn: () => runImageEditTest('pose-changer', faceImage, `${promptBase} Change pose to a relaxed standing pose, hands in pockets.`) },
    { name: 'swap-face', fn: () => runImageEditTest('swap-face', faceImage, `${promptBase} Keep identity and face, update outfit styling.`) },
    { name: 'relight', fn: () => runImageEditTest('relight', defaultImage, 'Relight this image with soft, diffused daylight from the left.') },
    { name: 'watermark-remover', fn: () => runImageEditTest('watermark-remover', defaultImage, 'Retouch this image to remove any artifacts and restore a clean version. Keep content unchanged.') },
    { name: 'try-on', fn: () => runImageEditTest('try-on', altImage, 'Virtually try on a minimalist beige trench coat with clean tailoring.') },
    { name: 'photo-album', fn: () => runImageEditTest('photo-album', defaultImage, 'Create a polished editorial photo from this image.') },
    { name: 'image-editor-t2i', fn: () => runTextToImageTest('image-editor-t2i', 'A minimalist studio product photo of a white t-shirt on a hanger, soft lighting.') },
    { name: 'image-editor-edit', fn: () => runImageEditTest('image-editor-edit', defaultImage, 'Convert this into a high-end product photo with subtle shadows.') },
    { name: 'outfit-analysis', fn: () => runImageToTextTest('outfit-analysis', defaultImage, 'Analyze the outfit and return a JSON array of {item, description, possibleBrands}.') },
  ];

  let failed = 0;
  for (const test of tests) {
    try {
      await test.fn();
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failed > 0) {
    console.error(`Smoke test completed with ${failed} failure(s).`);
    process.exit(1);
  }
  console.log('Feature smoke test completed successfully.');
}

run().catch((error) => {
  console.error(`Smoke test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
