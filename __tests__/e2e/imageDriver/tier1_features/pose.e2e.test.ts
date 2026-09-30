import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  InMemoryImageDriverFake,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_PROMPTS } from '../harness/testFixtures';

describe('Tier 1: Feature 4 - Pose Changer (pose)', () => {
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

  it('4.1: modifies pose on Gemini preserving subject likeness at 3:4 ratio', async () => {
    const results = await geminiDriver.generate({
      prompt: FIXTURE_PROMPTS.poseChange,
      images: [FIXTURE_IMAGES.modelSubjectA],
      aspectRatio: '3:4',
      resolution: '2K',
      workflow: 'pose',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gemini_result_3:4_2K_0');

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].workflow).toBe('pose');
  });

  it('4.2: modifies pose on GPT Image with 3:4 ratio mapped to 1024x1536', async () => {
    const results = await gptDriver.generate({
      prompt: FIXTURE_PROMPTS.poseChange,
      images: [FIXTURE_IMAGES.modelSubjectA],
      aspectRatio: '3:4',
      workflow: 'pose',
      negativePrompt: 'awkward limbs, extra fingers, stiff posture',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gpt_image_1024x1536_0');

    const recorded = gptDriver.getRecordedJobs();
    expect(recorded[0].resolvedDimensions).toBe('1024x1536');
    expect(recorded[0].prompt).toContain('awkward limbs');
  });

  it('4.3: executes pose adjustment safely on Local Qwen', async () => {
    const results = await localDriver.generate({
      prompt: FIXTURE_PROMPTS.poseChange,
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'pose',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('local_qwen_asset_0');
  });

  it('4.4: generates multiple pose angles for selection (count: 3)', async () => {
    const poses = await fakeDriver.generate({
      prompt: 'Generate 3 distinct editorial poses: standing, walking, seated',
      images: [FIXTURE_IMAGES.modelSubjectA],
      count: 3,
      workflow: 'pose',
    });

    expect(poses).toHaveLength(3);
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].count).toBe(3);
  });

  it('4.5: upscales approved pose asset to 4K resolution', async () => {
    const poseAsset = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.poseChange,
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'pose',
    });

    const upscaled = await fakeDriver.upscale({
      image: poseAsset,
      quality: '4K',
    });

    expect(upscaled.base64).toContain('upscaled_4K_');
  });

  it('4.6: preserves clothing drape across pose alteration', async () => {
    const job = {
      prompt: `${FIXTURE_PROMPTS.poseChange} Maintain fabric drape and outfit appearance.`,
      references: [
        { image: FIXTURE_IMAGES.modelSubjectA, role: 'subject' as const, label: 'Model' },
        { image: FIXTURE_IMAGES.silkBlouseTop, role: 'garment' as const, label: 'Top' },
      ],
      workflow: 'pose',
    };

    const result = await fakeDriver.generateOne(job);
    expect(result).toBeDefined();

    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].references).toHaveLength(2);
  });
});
