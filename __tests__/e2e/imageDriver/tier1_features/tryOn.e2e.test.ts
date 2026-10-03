import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  InMemoryImageDriverFake,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_REFERENCES, FIXTURE_PROMPTS } from '../harness/testFixtures';
import { UNTUCKED_DRAPE_INSTRUCTION } from '@/utils/outfitDrapePolicy';

describe('Tier 1: Feature 1 - Virtual Try-On (try-on)', () => {
  let fakeDriver: InMemoryImageDriverFake;
  let geminiDriver: GeminiImageDriverTestDouble;
  let gptDriver: GptImageDriverTestDouble;
  let localDriver: LocalQwenImageDriverTestDouble;

  beforeEach(() => {
    fakeDriver = createTestDriver('fake') as InMemoryImageDriverFake;
    geminiDriver = createTestDriver('gemini') as GeminiImageDriverTestDouble;
    gptDriver = createTestDriver('gptImage') as GptImageDriverTestDouble;
    localDriver = createTestDriver('localQwen') as LocalQwenImageDriverTestDouble;
  });

  it('1.1: successfully generates try-on results on Gemini with 3:4 aspect ratio and 2K resolution', async () => {
    const progressLogs: string[] = [];
    const results = await geminiDriver.generate({
      prompt: FIXTURE_PROMPTS.tryOn,
      references: FIXTURE_REFERENCES.tryOnTwoPiece,
      aspectRatio: '3:4',
      resolution: '2K',
      count: 2,
      workflow: 'try-on',
      onProgress: (msg) => progressLogs.push(msg),
    });

    expect(results).toHaveLength(2);
    expect(results[0].base64).toContain('gemini_result_3:4_2K_0');
    expect(results[1].base64).toContain('gemini_result_3:4_2K_1');
    expect(progressLogs.length).toBeGreaterThan(0);

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].aspectRatio).toBe('3:4');
  });

  it('1.2: successfully generates try-on on GPT Image with automatic pixel dimension mapping', async () => {
    const results = await gptDriver.generate({
      prompt: FIXTURE_PROMPTS.tryOn,
      images: [FIXTURE_IMAGES.modelSubjectA, FIXTURE_IMAGES.silkBlouseTop],
      aspectRatio: '3:4',
      negativePrompt: 'blurry, distorted hands, low resolution',
      count: 1,
      workflow: 'try-on',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gpt_image_1024x1536_0');

    const recorded = gptDriver.getRecordedJobs();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].resolvedDimensions).toBe('1024x1536');
    expect(recorded[0].prompt).toContain('[Negative Prompt]: blurry, distorted hands');
  });

  it('1.3: executes try-on safely on Local Qwen driver', async () => {
    const progressLogs: string[] = [];
    const results = await localDriver.generate({
      prompt: FIXTURE_PROMPTS.tryOn,
      images: [FIXTURE_IMAGES.modelSubjectA, FIXTURE_IMAGES.silkBlouseTop],
      workflow: 'try-on',
      count: 1,
      onProgress: (m) => progressLogs.push(m),
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('local_qwen_asset_0');
    expect(progressLogs).toContain('LocalQwen: executing ComfyUI workflow...');

    const recorded = localDriver.getRecordedJobs();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].injectedLora).toBeUndefined(); // Try-on does not inject FaceSwap LoRA
  });

  it('1.4: generateOne returns a single ImageFile directly', async () => {
    const singleImage = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.tryOn,
      references: FIXTURE_REFERENCES.tryOnTwoPiece,
      aspectRatio: '1:1',
      workflow: 'try-on',
    });

    expect(singleImage).toBeDefined();
    expect(singleImage.mimeType).toBe('image/png');
    expect(singleImage.base64).toContain('synthetic_img_');

    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].count).toBe(1);
  });

  it('1.5: upscales try-on generated asset to 2K and 4K quality targets', async () => {
    const tryOnAsset = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.tryOn,
      aspectRatio: '3:4',
      workflow: 'try-on',
    });

    const upscaled2K = await fakeDriver.upscale({
      image: tryOnAsset,
      quality: '2K',
    });
    expect(upscaled2K.base64).toContain('upscaled_2K_');

    const upscaled4K = await fakeDriver.upscale({
      image: tryOnAsset,
      quality: '4K',
    });
    expect(upscaled4K.base64).toContain('upscaled_4K_');

    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded).toHaveLength(3); // 1 generate + 2 upscales
  });

  it('1.6: preserves Outfit Drape Invariant (tops untucked outside waistband)', async () => {
    await geminiDriver.generate({
      prompt: 'Dress subject in silk blouse and trousers without extra instructions',
      workflow: 'try-on',
    });

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].prompt).toContain(UNTUCKED_DRAPE_INSTRUCTION);
  });
});
