import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  InMemoryImageDriverFake,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_PROMPTS } from '../harness/testFixtures';

describe('Tier 1: Feature 7 - Watermark Remover (watermark-remover)', () => {
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

  it('7.1: removes watermark on Gemini preserving original image composition', async () => {
    const cleaned = await geminiDriver.generateOne({
      prompt: FIXTURE_PROMPTS.watermarkRemove,
      images: [FIXTURE_IMAGES.watermarkedImage],
      workflow: 'watermark-remover',
      resolution: '2K',
    });

    expect(cleaned).toBeDefined();
    expect(cleaned.base64).toContain('gemini_result_1:1_2K_0');

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].workflow).toBe('watermark-remover');
  });

  it('7.2: removes watermark on GPT Image driver', async () => {
    const cleaned = await gptDriver.generateOne({
      prompt: FIXTURE_PROMPTS.watermarkRemove,
      images: [FIXTURE_IMAGES.watermarkedImage],
      workflow: 'watermark-remover',
      aspectRatio: '1:1',
    });

    expect(cleaned).toBeDefined();
    expect(cleaned.base64).toContain('gpt_image_1024x1024_0');
  });

  it('7.3: executes watermark removal locally on Local Qwen driver', async () => {
    const cleaned = await localDriver.generateOne({
      prompt: FIXTURE_PROMPTS.watermarkRemove,
      images: [FIXTURE_IMAGES.watermarkedImage],
      workflow: 'watermark-remover',
    });

    expect(cleaned).toBeDefined();
    expect(cleaned.base64).toContain('local_qwen_asset_0');
  });

  it('7.4: processes batch queue of watermarked fashion assets', async () => {
    const queue = [
      FIXTURE_IMAGES.watermarkedImage,
      FIXTURE_IMAGES.watermarkedImage,
      FIXTURE_IMAGES.watermarkedImage,
    ];

    const results = await Promise.all(
      queue.map((img, idx) =>
        fakeDriver.generateOne({
          prompt: `${FIXTURE_PROMPTS.watermarkRemove} item #${idx}`,
          images: [img],
          workflow: 'watermark-remover',
        })
      )
    );

    expect(results).toHaveLength(3);
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded).toHaveLength(3);
  });

  it('7.5: supports explicit mask reference role for targeted watermark eradication', async () => {
    const cleaned = await fakeDriver.generateOne({
      prompt: 'Inpaint designated logo region seamlessly',
      references: [
        { image: FIXTURE_IMAGES.watermarkedImage, role: 'subject', label: 'Source photo' },
        { image: FIXTURE_IMAGES.watermarkedImage, role: 'mask', label: 'Watermark bounding mask' },
      ],
      workflow: 'watermark-remover',
    });

    expect(cleaned).toBeDefined();
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].references![1].role).toBe('mask');
  });

  it('7.6: upscales cleaned asset to high resolution 4K output', async () => {
    const cleaned = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.watermarkRemove,
      workflow: 'watermark-remover',
    });

    const upscaled = await fakeDriver.upscale({
      image: cleaned,
      quality: '4K',
    });

    expect(upscaled.base64).toContain('upscaled_4K_');
  });
});
