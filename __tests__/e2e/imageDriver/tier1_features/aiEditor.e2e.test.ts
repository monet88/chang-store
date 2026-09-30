import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  InMemoryImageDriverFake,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_PROMPTS } from '../harness/testFixtures';

describe('Tier 1: Feature 6 - AI Editor (ai-editor)', () => {
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

  it('6.1: executes natural language edit on Gemini via generateOne', async () => {
    const editedImage = await geminiDriver.generateOne({
      prompt: FIXTURE_PROMPTS.aiEditor,
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'ai-editor',
      aspectRatio: '3:4',
      resolution: '2K',
    });

    expect(editedImage).toBeDefined();
    expect(editedImage.base64).toContain('gemini_result_3:4_2K_0');

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].workflow).toBe('ai-editor');
  });

  it('6.2: executes natural language edit on GPT Image with negative prompt', async () => {
    const editedImage = await gptDriver.generateOne({
      prompt: FIXTURE_PROMPTS.aiEditor,
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'ai-editor',
      aspectRatio: '1:1',
      negativePrompt: 'harsh contrast, noise, artifacting',
    });

    expect(editedImage).toBeDefined();
    expect(editedImage.base64).toContain('gpt_image_1024x1024_0');

    const recorded = gptDriver.getRecordedJobs();
    expect(recorded[0].prompt).toContain('[Negative Prompt]: harsh contrast');
  });

  it('6.3: executes retouching edit on Local Qwen driver', async () => {
    const editedImage = await localDriver.generateOne({
      prompt: FIXTURE_PROMPTS.aiEditor,
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'ai-editor',
    });

    expect(editedImage).toBeDefined();
    expect(editedImage.base64).toContain('local_qwen_asset_0');
  });

  it('6.4: supports iterative chained edits (output of edit 1 becomes input of edit 2)', async () => {
    // Pass 1: Adjust collar neckline
    const pass1Result = await fakeDriver.generateOne({
      prompt: 'Adjust neckline to V-neck cut',
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'ai-editor',
    });
    expect(pass1Result).toBeDefined();

    // Pass 2: Color tweak using pass 1 result
    const pass2Result = await fakeDriver.generateOne({
      prompt: 'Change blouse hue to warm emerald tone',
      images: [pass1Result],
      workflow: 'ai-editor',
    });
    expect(pass2Result).toBeDefined();

    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded).toHaveLength(2);
    expect(recorded[1].images![0].base64).toBe(pass1Result.base64);
  });

  it('6.5: supports inpainting reference roles with explicit mask role', async () => {
    const result = await fakeDriver.generateOne({
      prompt: 'Inpaint designated area with smooth cotton texture',
      references: [
        { image: FIXTURE_IMAGES.modelSubjectA, role: 'subject', label: 'Base photo' },
        { image: FIXTURE_IMAGES.watermarkedImage, role: 'mask', label: 'Edit mask region' },
      ],
      workflow: 'ai-editor',
    });

    expect(result).toBeDefined();
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].references![1].role).toBe('mask');
  });

  it('6.6: upscales retouched result to 4K resolution', async () => {
    const edited = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.aiEditor,
      workflow: 'ai-editor',
    });

    const upscaled = await fakeDriver.upscale({
      image: edited,
      quality: '4K',
    });

    expect(upscaled.base64).toContain('upscaled_4K_');
  });
});
