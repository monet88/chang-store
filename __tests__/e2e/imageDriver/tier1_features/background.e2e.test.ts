import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  InMemoryImageDriverFake,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_PROMPTS } from '../harness/testFixtures';

describe('Tier 1: Feature 3 - Background Replacer (background)', () => {
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

  it('3.1: replaces background on Gemini with 16:9 widescreen ratio and 2K resolution', async () => {
    const results = await geminiDriver.generate({
      prompt: FIXTURE_PROMPTS.backgroundReplace,
      images: [FIXTURE_IMAGES.modelSubjectA],
      aspectRatio: '16:9',
      resolution: '2K',
      workflow: 'background',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gemini_result_16:9_2K_0');

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].workflow).toBe('background');
  });

  it('3.2: replaces background on GPT Image with automatic 16:9 dimension mapping', async () => {
    const results = await gptDriver.generate({
      prompt: FIXTURE_PROMPTS.backgroundReplace,
      images: [FIXTURE_IMAGES.modelSubjectA],
      aspectRatio: '16:9',
      workflow: 'background',
      negativePrompt: 'blurry background, cars, people in background',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gpt_image_1792x1024_0');

    const recorded = gptDriver.getRecordedJobs();
    expect(recorded[0].resolvedDimensions).toBe('1792x1024');
    expect(recorded[0].prompt).toContain('blurry background');
  });

  it('3.3: replaces background safely on Local Qwen driver', async () => {
    const results = await localDriver.generate({
      prompt: FIXTURE_PROMPTS.backgroundReplace,
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'background',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('local_qwen_asset_0');
  });

  it('3.4: generates batch candidate backgrounds (count: 4) for client selection', async () => {
    const candidates = await fakeDriver.generate({
      prompt: FIXTURE_PROMPTS.backgroundReplace,
      images: [FIXTURE_IMAGES.modelSubjectA],
      count: 4,
      workflow: 'background',
    });

    expect(candidates).toHaveLength(4);
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].count).toBe(4);
  });

  it('3.5: upscales chosen background replacement asset to 4K', async () => {
    const result = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.backgroundReplace,
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'background',
    });

    const upscaled = await fakeDriver.upscale({
      image: result,
      quality: '4K',
    });

    expect(upscaled.base64).toContain('upscaled_4K_');
  });

  it('3.6: processes semantic reference roles (subject + background scene style)', async () => {
    const result = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.backgroundReplace,
      references: [
        { image: FIXTURE_IMAGES.modelSubjectA, role: 'subject', label: 'Foreground model' },
        { image: FIXTURE_IMAGES.fabricSwatchTextile, role: 'style', label: 'Color palette reference' },
      ],
      workflow: 'background',
    });

    expect(result).toBeDefined();
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].references).toHaveLength(2);
    expect(recorded[0].references![1].role).toBe('style');
  });
});
