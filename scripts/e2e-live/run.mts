/**
 * Live E2E harness - exercises all 9 Chang Store features through the real
 * app service code path, routed via the vertex.monet.uno/gemini gateway.
 * Not part of the app bundle. Run: E2E_LIVE_API_KEY=... npx tsx scripts/e2e-live/run.mts
 * Optional override: E2E_LIVE_BASE_URL=https://vertex.monet.uno/gemini
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';

import { getLiveE2EConfig } from './config';

import { configureGeminiClient } from '../../src/services/apiClient';
import {
  editImage,
  generateImage,
  upscaleImage,
} from '../../src/services/imageEditingService';
import { generateText, generateClothingDescription } from '../../src/services/textService';
import type { ImageFile } from '../../src/types';

import { buildVirtualTryOnParts } from '../../src/utils/virtual-try-on-prompt-builder';
import { buildClothingTransferParts } from '../../src/utils/clothing-transfer-prompt-builder';
import { buildTextPosePrompt } from '../../src/utils/pose-changer-prompt-builder';
import { buildPhotoAlbumPrompt } from '../../src/utils/photo-album-prompt-builder';
import { buildBackgroundReplacementPrompt } from '../../src/utils/background-replacer-prompt-builder';
import { buildPatternGeneratorParts, TASK_PROMPT } from '../../src/utils/pattern-generator-prompt-builder';
import { buildSingleImageEditPrompt } from '../../src/utils/ai-editor-prompt-builder';
import { buildLookbookPrompt, type LookbookFormState } from '../../src/utils/lookbookPromptBuilder';
import { getPromptText, DEFAULT_PROMPT_ID } from '../../src/utils/watermark-prompts';

const { gateway: GATEWAY, apiKey: API_KEY, imgDir: IMG_DIR, outDir: OUT_DIR } = getLiveE2EConfig();
const EDIT_MODEL = 'gemini-3.1-flash-image';
const TEXT_MODEL = 'gemini-3.5-flash';

mkdirSync(OUT_DIR, { recursive: true });

const mimeFor = (p: string): string => {
  const ext = extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
};
const loadImage = (name: string): ImageFile => {
  const p = resolve(IMG_DIR, name);
  return { base64: readFileSync(p).toString('base64'), mimeType: mimeFor(p) };
};

const IMAGES = {
  subject: loadImage('s90.jpg'),
  outfit: loadImage('V66.jpg'),
  reference: loadImage('X01N.png'),
  watermarked: loadImage('tesst-wtmark.jpg'),
};

const cfg = { onStatusUpdate: (_m: string) => {} };

interface Result { feature: string; ok: boolean; detail: string; ms: number; outFile?: string; }
const results: Result[] = [];

const saveOut = (feature: string, img: ImageFile): string => {
  const ext = img.mimeType.includes('png') ? 'png' : img.mimeType.includes('webp') ? 'webp' : 'jpg';
  const file = feature + '.' + ext;
  writeFileSync(resolve(OUT_DIR, file), Buffer.from(img.base64, 'base64'));
  return file;
};

const run = async (feature: string, fn: () => Promise<{ detail: string; img?: ImageFile }>) => {
  const start = Date.now();
  process.stdout.write('\n> ' + feature + ' ... ');
  try {
    const { detail, img } = await fn();
    const ms = Date.now() - start;
    const outFile = img ? saveOut(feature, img) : undefined;
    results.push({ feature, ok: true, detail, ms, outFile });
    process.stdout.write('OK (' + ms + 'ms) ' + detail + (outFile ? ' -> ' + outFile : ''));
  } catch (err) {
    const ms = Date.now() - start;
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ feature, ok: false, detail, ms });
    process.stdout.write('FAIL (' + ms + 'ms) ' + detail);
  }
};

const px = (img: ImageFile) => Math.round((img.base64.length * 0.75) / 1024) + 'KB ' + img.mimeType;

async function main() {
  configureGeminiClient({ apiKey: API_KEY, baseUrl: GATEWAY, requireExplicitApiKey: true });
  console.log('Gateway: ' + GATEWAY + '  model: ' + EDIT_MODEL);

  await run('01-try-on', async () => {
    const parts = buildVirtualTryOnParts({
      subjectImage: IMAGES.subject,
      sourceItems: [{ image: IMAGES.outfit, sourceItemType: 'clothing', sourcePrompt: '' }],
      extraPrompt: '', backgroundPrompt: '',
    });
    const [img] = await editImage({ images: [], prompt: '', interleavedParts: parts }, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('02-lookbook', async () => {
    const formState = {
      clothingDescription: 'a floral summer dress',
      lookbookStyle: 'flat lay', garmentType: 'one-piece',
      foldedPresentationType: 'boxed', mannequinBackgroundStyle: 'minimalistShowroom',
      negativePrompt: '', fabricTexturePrompt: '',
    } as unknown as LookbookFormState;
    const prompt = buildLookbookPrompt(formState, [IMAGES.outfit], null);
    const [img] = await editImage({ images: [IMAGES.outfit], prompt, aspectRatio: '3:4', resolution: '2K' }, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('03-background', async () => {
    const prompt = buildBackgroundReplacementPrompt({
      framingInstruction: 'Keep the subject framing unchanged.',
      hasBackgroundImage: false, promptText: 'a sunny beach at golden hour',
    });
    const [img] = await editImage({ images: [IMAGES.subject], prompt, aspectRatio: '3:4', resolution: '2K' }, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('04-pose', async () => {
    const prompt = buildTextPosePrompt('standing with hands on hips, confident pose', 'Full body shot.');
    const [img] = await editImage({ images: [IMAGES.subject], prompt, aspectRatio: '3:4', resolution: '2K' }, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('05-photo-album', async () => {
    const prompt = buildPhotoAlbumPrompt({
      imageRolesPrompt: "**Image Role**: The provided image contains the model, outfit and footwear. Extract them and place in a new scene.",
      framingInstruction: 'Use default framing provided by the model.',
      poseInstruction: 'Natural relaxed standing pose.',
      hairStyle: 'long straight black hair', skinTone: 'fair smooth skin',
      footwearInstruction: 'Keep the original footwear.',
      backgroundInstruction: 'Place the model in a bright modern studio.',
      frameInstruction: 'Do not add any frame or border.',
      additionalNotesInstruction: '- No additional notes.',
    });
    const [img] = await editImage({ images: [IMAGES.subject], prompt, aspectRatio: '9:16', resolution: '2K' }, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('06-ai-editor', async () => {
    const prompt = buildSingleImageEditPrompt('Make the lighting warmer and add a subtle vignette.');
    const [img] = await editImage({ images: [IMAGES.reference], prompt }, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('07-watermark-remover', async () => {
    const prompt = getPromptText(DEFAULT_PROMPT_ID);
    const [img] = await editImage({ images: [IMAGES.watermarked], prompt }, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('08-clothing-transfer', async () => {
    const parts = buildClothingTransferParts(IMAGES.subject, [{ image: IMAGES.outfit, label: 'dress' }], '');
    const [img] = await editImage({ images: [], prompt: '', interleavedParts: parts }, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('09-pattern-generator', async () => {
    const parts = buildPatternGeneratorParts([IMAGES.reference], TASK_PROMPT);
    const [img] = await editImage({ images: [], prompt: '', interleavedParts: parts }, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('10-image-generate', async () => {
    const [img] = await generateImage('A minimalist product photo of a white sneaker on a pastel background', '1:1', 1, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('11-upscale', async () => {
    const img = await upscaleImage(IMAGES.subject, EDIT_MODEL, cfg);
    return { detail: px(img), img };
  });

  await run('12-text-generate', async () => {
    const text = await generateText('Reply with exactly: chang-store-ok', TEXT_MODEL as any);
    return { detail: '"' + text.trim().slice(0, 60) + '"' };
  });

  await run('13-vision-describe', async () => {
    const desc = await generateClothingDescription(IMAGES.outfit, TEXT_MODEL);
    return { detail: '"' + desc.trim().slice(0, 80) + '..."' };
  });

  console.log('\n\n================ E2E SUMMARY ================');
  const pass = results.filter((r) => r.ok).length;
  for (const r of results) {
    console.log((r.ok ? 'PASS' : 'FAIL') + ' ' + r.feature.padEnd(22) + String(r.ms).padStart(6) + 'ms  ' + r.detail + (r.outFile ? '  [' + r.outFile + ']' : ''));
  }
  console.log('\n' + pass + '/' + results.length + ' passed. Outputs in ' + OUT_DIR);
  writeFileSync(resolve(OUT_DIR, '_summary.json'), JSON.stringify(results, null, 2));
  if (pass !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
