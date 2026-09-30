import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  InMemoryImageDriverFake,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_PROMPTS } from '../harness/testFixtures';

describe('Tier 1: Feature 2 - Lookbook (lookbook)', () => {
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

  it('2.1: generates lookbook shots across multiple catalog aspect ratios on Gemini', async () => {
    const ratios = ['3:4', '9:16', '1:1'] as const;
    for (const ratio of ratios) {
      const results = await geminiDriver.generate({
        prompt: FIXTURE_PROMPTS.lookbookCatalog,
        images: [FIXTURE_IMAGES.modelSubjectA],
        aspectRatio: ratio,
        resolution: '4K',
        count: 1,
        workflow: 'lookbook',
      });
      expect(results).toHaveLength(1);
      expect(results[0].base64).toContain(`gemini_result_${ratio}_4K_0`);
    }

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded).toHaveLength(3);
  });

  it('2.2: generates lookbook on GPT Image with 3:4 ratio mapping to 1024x1536', async () => {
    const results = await gptDriver.generate({
      prompt: FIXTURE_PROMPTS.lookbookCatalog,
      images: [FIXTURE_IMAGES.modelSubjectA],
      aspectRatio: '3:4',
      workflow: 'lookbook',
      negativePrompt: 'harsh lighting, deformed anatomy, clutter',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gpt_image_1024x1536_0');

    const recorded = gptDriver.getRecordedJobs();
    expect(recorded[0].resolvedDimensions).toBe('1024x1536');
    expect(recorded[0].prompt).toContain('harsh lighting');
  });

  it('2.3: runs lookbook generation safely on Local Qwen driver', async () => {
    const results = await localDriver.generate({
      prompt: FIXTURE_PROMPTS.lookbookCatalog,
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'lookbook',
      count: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('local_qwen_asset_0');
  });

  it('2.4: generates multi-angle lookbook variations in batch', async () => {
    const variations = await fakeDriver.generate({
      prompt: 'Lookbook variations: 3-angle catalog presentation (front, 45-degree, side)',
      images: [FIXTURE_IMAGES.modelSubjectA],
      count: 3,
      aspectRatio: '3:4',
      workflow: 'lookbook',
    });

    expect(variations).toHaveLength(3);
    variations.forEach((v) => {
      expect(v.mimeType).toBe('image/png');
    });

    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].count).toBe(3);
  });

  it('2.5: upscales lookbook catalog shot to 4K publication quality', async () => {
    const shot = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.lookbookCatalog,
      aspectRatio: '3:4',
      workflow: 'lookbook',
    });

    const upscaled = await fakeDriver.upscale({
      image: shot,
      quality: '4K',
    });

    expect(upscaled.base64).toContain('upscaled_4K_');
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[1].quality).toBe('4K');
  });
});
