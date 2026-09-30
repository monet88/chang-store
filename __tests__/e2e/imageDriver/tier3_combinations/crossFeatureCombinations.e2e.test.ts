import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  InMemoryImageDriverFake,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_REFERENCES, FIXTURE_PROMPTS } from '../harness/testFixtures';

describe('Tier 3: Cross-Feature Combinations (Pairwise Seam Interactions)', () => {
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

  it('3.1: Virtual Try-On output piped directly into 4K Upscale pipeline', async () => {
    // Step 1: Generate Try-On preview at 1K
    const preview = await geminiDriver.generateOne({
      prompt: FIXTURE_PROMPTS.tryOn,
      references: FIXTURE_REFERENCES.tryOnTwoPiece,
      aspectRatio: '3:4',
      resolution: '1K',
      workflow: 'try-on',
    });

    expect(preview.base64).toContain('gemini_result_3:4_1K_0');

    // Step 2: Operator triggers 4K upscale of preview
    const upscaled = await geminiDriver.upscale({
      image: preview,
      quality: '4K',
    });

    expect(upscaled.base64).toContain('gemini_upscaled_4K_');
    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded).toHaveLength(2);
    expect(recorded[0].workflow).toBe('try-on');
    expect(recorded[1].quality).toBe('4K');
  });

  it('3.2: Clothing Transfer result staged into Lookbook catalog across 3 aspect ratios', async () => {
    // Step 1: Transfer garment to destination brand model
    const transferred = await gptDriver.generateOne({
      prompt: FIXTURE_PROMPTS.clothingTransfer,
      images: [FIXTURE_IMAGES.modelSubjectA, FIXTURE_IMAGES.woolBlazerOuterwear],
      aspectRatio: '3:4',
      workflow: 'clothing-transfer',
    });

    expect(transferred.base64).toContain('gpt_image_1024x1536_0');

    // Step 2: Stage transferred model photo into Lookbook catalog shots
    const catalogRatios = ['3:4', '1:1', '9:16'] as const;
    const catalogShots = await Promise.all(
      catalogRatios.map((ratio) =>
        gptDriver.generateOne({
          prompt: `${FIXTURE_PROMPTS.lookbookCatalog} featuring newly transferred garment`,
          images: [transferred],
          aspectRatio: ratio,
          workflow: 'lookbook',
        })
      )
    );

    expect(catalogShots).toHaveLength(3);
    const recorded = gptDriver.getRecordedJobs();
    expect(recorded).toHaveLength(4); // 1 transfer + 3 lookbook
    expect(recorded[1].resolvedDimensions).toBe('1024x1536');
    expect(recorded[2].resolvedDimensions).toBe('1024x1024');
    expect(recorded[3].resolvedDimensions).toBe('1024x1792');
  });

  it('3.3: Identity Transfer on Local Qwen with LoRA auto-injection vs prompt refusal toggle', async () => {
    // Workflow A: Standard identity transfer -> auto-injects FaceSwap LoRA
    const resAutoInject = await localDriver.generateOne({
      prompt: FIXTURE_PROMPTS.identityTransfer,
      images: [FIXTURE_IMAGES.modelSubjectB, FIXTURE_IMAGES.brandModelFemale],
      workflow: 'identity-transfer',
    });
    expect(resAutoInject.base64).toContain('faceswap');

    // Workflow B: Identity transfer with explicit refusal phrase -> suppresses LoRA
    const resRefusal = await localDriver.generateOne({
      prompt: FIXTURE_PROMPTS.identityTransferRefusal,
      images: [FIXTURE_IMAGES.modelSubjectB, FIXTURE_IMAGES.brandModelFemale],
      workflow: 'identity-transfer',
    });
    expect(resRefusal.base64).not.toContain('faceswap');

    const recorded = localDriver.getRecordedJobs();
    expect(recorded[0].injectedLora).toBe('bfs_head_v1.1_qwen_2.1.safetensors');
    expect(recorded[1].injectedLora).toBeUndefined();
  });

  it('3.4: AI Editor chained retouching with mask inpainting', async () => {
    // Edit 1: Adjust blouse fit
    const edit1 = await fakeDriver.generateOne({
      prompt: 'Refine silhouette and waist fit',
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'ai-editor',
    });

    // Edit 2: Apply targeted inpainting using mask role
    const edit2 = await fakeDriver.generateOne({
      prompt: 'Inpaint smooth collar texture',
      references: [
        { image: edit1, role: 'subject', label: 'Base edited photo' },
        { image: FIXTURE_IMAGES.watermarkedImage, role: 'mask', label: 'Collar mask' },
      ],
      workflow: 'ai-editor',
    });

    expect(edit2).toBeDefined();
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded).toHaveLength(2);
    expect(recorded[1].references![0].image.base64).toBe(edit1.base64);
  });

  it('3.5: Pattern Generator textile synthesis fed as garment texture into Try-On', async () => {
    // Step 1: Generate custom herringbone textile pattern
    const pattern = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.patternGenerator,
      aspectRatio: '1:1',
      resolution: '4K',
      workflow: 'pattern-generator',
    });

    // Step 2: Use pattern as style/fabric reference in Virtual Try-On
    const tryOnResult = await fakeDriver.generateOne({
      prompt: 'Dress model in custom blazer tailored from the attached pattern',
      references: [
        { image: FIXTURE_IMAGES.modelSubjectA, role: 'subject', label: 'Model' },
        { image: pattern, role: 'style', label: 'Custom woven textile pattern' },
      ],
      workflow: 'try-on',
    });

    expect(tryOnResult).toBeDefined();
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[1].references![1].image.base64).toBe(pattern.base64);
  });

  it('3.6: Background Replacement followed by Pose Changer preserving environment', async () => {
    // Step 1: Replace background with Parisian cafe
    const sceneResult = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.backgroundReplace,
      images: [FIXTURE_IMAGES.modelSubjectA],
      aspectRatio: '16:9',
      workflow: 'background',
    });

    // Step 2: Adjust model pose in new background
    const finalResult = await fakeDriver.generateOne({
      prompt: 'Adjust model to seated pose while preserving the Parisian cafe background',
      images: [sceneResult],
      aspectRatio: '16:9',
      workflow: 'pose',
    });

    expect(finalResult).toBeDefined();
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded).toHaveLength(2);
    expect(recorded[1].workflow).toBe('pose');
  });
});
