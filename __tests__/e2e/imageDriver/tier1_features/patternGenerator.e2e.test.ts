import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  InMemoryImageDriverFake,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_PROMPTS } from '../harness/testFixtures';

describe('Tier 1: Feature 10 - Pattern Generator (pattern-generator)', () => {
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

  it('10.1: generates seamless textile pattern on Gemini at canonical 1:1 ratio and 4K resolution', async () => {
    const results = await geminiDriver.generate({
      prompt: FIXTURE_PROMPTS.patternGenerator,
      aspectRatio: '1:1',
      resolution: '4K',
      workflow: 'pattern-generator',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gemini_result_1:1_4K_0');

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].aspectRatio).toBe('1:1');
    expect(recorded[0].resolution).toBe('4K');
  });

  it('10.2: generates seamless pattern on GPT Image with 1:1 ratio mapped to 1024x1024', async () => {
    const results = await gptDriver.generate({
      prompt: FIXTURE_PROMPTS.patternGenerator,
      aspectRatio: '1:1',
      workflow: 'pattern-generator',
      negativePrompt: 'seams, borders, cutoffs, non-tileable patterns',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gpt_image_1024x1024_0');

    const recorded = gptDriver.getRecordedJobs();
    expect(recorded[0].resolvedDimensions).toBe('1024x1024');
    expect(recorded[0].prompt).toContain('non-tileable patterns');
  });

  it('10.3: generates pattern safely on Local Qwen driver', async () => {
    const results = await localDriver.generate({
      prompt: FIXTURE_PROMPTS.patternGenerator,
      workflow: 'pattern-generator',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('local_qwen_asset_0');
  });

  it('10.4: generates pattern from fabric swatch reference style', async () => {
    const result = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.patternGenerator,
      references: [
        {
          image: FIXTURE_IMAGES.fabricSwatchTextile,
          role: 'style',
          label: 'Fabric weave and texture reference',
        },
      ],
      aspectRatio: '1:1',
      workflow: 'pattern-generator',
    });

    expect(result).toBeDefined();
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].references).toHaveLength(1);
    expect(recorded[0].references![0].role).toBe('style');
  });

  it('10.5: generates batch of 4 seamless pattern variations', async () => {
    const patterns = await fakeDriver.generate({
      prompt: `${FIXTURE_PROMPTS.patternGenerator} - 4 thread count variations`,
      count: 4,
      aspectRatio: '1:1',
      workflow: 'pattern-generator',
    });

    expect(patterns).toHaveLength(4);
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].count).toBe(4);
  });

  it('10.6: upscales seamless pattern tile to 4K resolution', async () => {
    const pattern = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.patternGenerator,
      aspectRatio: '1:1',
      workflow: 'pattern-generator',
    });

    const upscaled = await fakeDriver.upscale({
      image: pattern,
      quality: '4K',
    });

    expect(upscaled.base64).toContain('upscaled_4K_');
  });
});
