import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  InMemoryImageDriverFake,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_REFERENCES, FIXTURE_PROMPTS } from '../harness/testFixtures';

describe('Tier 1: Feature 9 - Identity Transfer (identity-transfer)', () => {
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

  it('9.1: transfers identity on Gemini with 3:4 aspect ratio and 2K resolution', async () => {
    const results = await geminiDriver.generate({
      prompt: FIXTURE_PROMPTS.identityTransfer,
      references: FIXTURE_REFERENCES.identityTransfer,
      aspectRatio: '3:4',
      resolution: '2K',
      workflow: 'identity-transfer',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gemini_result_3:4_2K_0');

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].workflow).toBe('identity-transfer');
  });

  it('9.2: transfers identity on GPT Image with automatic 3:4 dimension mapping', async () => {
    const results = await gptDriver.generate({
      prompt: FIXTURE_PROMPTS.identityTransfer,
      images: [FIXTURE_IMAGES.modelSubjectB, FIXTURE_IMAGES.brandModelFemale],
      aspectRatio: '3:4',
      workflow: 'identity-transfer',
      negativePrompt: 'distorted facial features, uncanny valley, asymmetrical eyes',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gpt_image_1024x1536_0');

    const recorded = gptDriver.getRecordedJobs();
    expect(recorded[0].resolvedDimensions).toBe('1024x1536');
  });

  it('9.3: auto-injects FaceSwap LoRA on Local Qwen when workflow is identity-transfer and prompt has no refusal', async () => {
    const results = await localDriver.generate({
      prompt: FIXTURE_PROMPTS.identityTransfer,
      images: [FIXTURE_IMAGES.modelSubjectB, FIXTURE_IMAGES.brandModelFemale],
      workflow: 'identity-transfer',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('local_qwen_faceswap_asset_0');

    const recorded = localDriver.getRecordedJobs();
    expect(recorded[0].injectedLora).toBe('bfs_head_v1.1_qwen_2.1.safetensors');
  });

  it('9.4: strictly suppresses FaceSwap LoRA when prompt explicitly refuses face swap', async () => {
    const refusalPhrases = [
      'Identity transfer: keep the original face without modification',
      'Transfer clothing style, no face swap allowed',
      'Giữ nguyên khuôn mặt gốc, không đổi mặt',
    ];

    for (const prompt of refusalPhrases) {
      localDriver.clearRecordedJobs();
      const results = await localDriver.generate({
        prompt,
        images: [FIXTURE_IMAGES.modelSubjectB, FIXTURE_IMAGES.brandModelFemale],
        workflow: 'identity-transfer',
      });

      expect(results).toHaveLength(1);
      expect(results[0].base64).not.toContain('faceswap');

      const recorded = localDriver.getRecordedJobs();
      expect(recorded[0].injectedLora).toBeUndefined();
    }
  });

  it('9.5: upscales transferred identity photo to 4K quality', async () => {
    const asset = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.identityTransfer,
      workflow: 'identity-transfer',
    });

    const upscaled = await fakeDriver.upscale({
      image: asset,
      quality: '4K',
    });

    expect(upscaled.base64).toContain('upscaled_4K_');
  });

  it('9.6: handles semantic reference roles (target scene as subject, likeness as style)', async () => {
    const result = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.identityTransfer,
      references: [
        { image: FIXTURE_IMAGES.modelSubjectB, role: 'subject', label: 'Target scene body' },
        { image: FIXTURE_IMAGES.brandModelFemale, role: 'style', label: 'Identity facial structure' },
      ],
      workflow: 'identity-transfer',
    });

    expect(result).toBeDefined();
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].references).toHaveLength(2);
    expect(recorded[0].references![0].role).toBe('subject');
    expect(recorded[0].references![1].role).toBe('style');
  });
});
