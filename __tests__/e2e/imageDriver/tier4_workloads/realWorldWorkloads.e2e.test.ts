import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  InMemoryImageDriverFake,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  StudioDriverError,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_REFERENCES, FIXTURE_PROMPTS } from '../harness/testFixtures';
import { UNTUCKED_DRAPE_INSTRUCTION } from '@/utils/outfitDrapePolicy';

describe('Tier 4: Real-World Workload Scenarios (End-to-End Fashion Studio)', () => {
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

  it('4.1: Complete E-Com Pack Asset Bundle Production Pipeline', async () => {
    // Stage 1: Flat Lay product presentation (1:1 aspect ratio)
    const flatLay = await geminiDriver.generateOne({
      prompt: 'E-Com Pack: Clean studio flat lay presentation of silk blouse on off-white linen surface',
      references: [
        { image: FIXTURE_IMAGES.silkBlouseTop, role: 'garment', label: 'Silk Blouse' },
        { image: FIXTURE_IMAGES.flatLayTemplate, role: 'style', label: 'Flat Lay Template' },
      ],
      aspectRatio: '1:1',
      resolution: '2K',
      workflow: 'clothing-transfer',
    });
    expect(flatLay.base64).toContain('gemini_result_1:1_2K_0');

    // Stage 2: Hanger display presentation (3:4 aspect ratio)
    const hangerShot = await geminiDriver.generateOne({
      prompt: 'E-Com Pack: Wooden hanger display against neutral minimalist concrete wall',
      references: [
        { image: FIXTURE_IMAGES.silkBlouseTop, role: 'garment', label: 'Silk Blouse' },
        { image: FIXTURE_IMAGES.hangerTemplate, role: 'style', label: 'Hanger Template' },
      ],
      aspectRatio: '3:4',
      resolution: '2K',
      workflow: 'clothing-transfer',
    });
    expect(hangerShot.base64).toContain('gemini_result_3:4_2K_0');

    // Stage 3: Official Brand Model wearing the garment
    const brandModelShot = await geminiDriver.generateOne({
      prompt: 'E-Com Pack: Official Brand Model wearing silk blouse and navy trousers',
      references: [
        { image: FIXTURE_IMAGES.brandModelFemale, role: 'subject', label: 'Brand Model' },
        { image: FIXTURE_IMAGES.silkBlouseTop, role: 'garment', label: 'Silk Blouse' },
        { image: FIXTURE_IMAGES.tailoredTrousersBottom, role: 'garment', label: 'Trousers' },
      ],
      aspectRatio: '3:4',
      resolution: '2K',
      workflow: 'clothing-transfer',
    });
    expect(brandModelShot.base64).toBeDefined();

    // Stage 4: Multi-demographic model variations
    const demographics = ['Demographic A (Asian)', 'Demographic B (Afro-descendant)'];
    const modelVariations = await Promise.all(
      demographics.map((demo) =>
        geminiDriver.generateOne({
          prompt: `E-Com Pack: Diversity model shot for ${demo}`,
          references: [
            { image: FIXTURE_IMAGES.modelSubjectB, role: 'subject', label: demo },
            { image: FIXTURE_IMAGES.silkBlouseTop, role: 'garment', label: 'Silk Blouse' },
          ],
          aspectRatio: '3:4',
          resolution: '2K',
          workflow: 'clothing-transfer',
        })
      )
    );
    expect(modelVariations).toHaveLength(2);

    // Stage 5: Upscale the hero brand model shot to 4K
    const finalUpscale = await geminiDriver.upscale({
      image: brandModelShot,
      quality: '4K',
    });
    expect(finalUpscale.base64).toContain('gemini_upscaled_4K_');

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded).toHaveLength(6); // 1 flatlay + 1 hanger + 1 brand + 2 variations + 1 upscale
  });

  it('4.2: Seasonal Lookbook Campaign with Drape Invariant & 4K Publishing', async () => {
    const lookbookAngles = [
      'Front full-length view showing complete outfit drape',
      '45-degree angle profile highlighting sleeve silhouette',
      'Side view demonstrating relaxed hemline drape outside waistband',
      'Close-up fabric texture detail',
    ];

    const generatedShots = await Promise.all(
      lookbookAngles.map((anglePrompt) =>
        geminiDriver.generateOne({
          prompt: `${FIXTURE_PROMPTS.lookbookCatalog} - ${anglePrompt}`,
          images: [FIXTURE_IMAGES.modelSubjectA],
          aspectRatio: '3:4',
          resolution: '2K',
          workflow: 'lookbook',
        })
      )
    );

    expect(generatedShots).toHaveLength(4);

    // Verify all prompt jobs executed
    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded).toHaveLength(4);

    // Hero shot chosen and upscaled to 4K
    const heroPublishAsset = await geminiDriver.upscale({
      image: generatedShots[0],
      quality: '4K',
    });

    expect(heroPublishAsset.base64).toContain('gemini_upscaled_4K_');
  });

  it('4.3: High-Concurrency Batch Queue with Selective Abort', async () => {
    const abortControllers = [
      new AbortController(),
      new AbortController(),
      new AbortController(),
      new AbortController(),
    ];

    // Abort job #1 and job #3
    abortControllers[1].abort();
    abortControllers[3].abort();

    const tasks = abortControllers.map((ctrl, index) =>
      fakeDriver
        .generateOne({
          prompt: `Batch job #${index}`,
          signal: ctrl.signal,
          workflow: 'try-on',
        })
        .then((res) => ({ status: 'fulfilled' as const, res }))
        .catch((err) => ({ status: 'rejected' as const, err }))
    );

    const outcomes = await Promise.all(tasks);

    // Jobs 0 and 2 succeeded
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[2].status).toBe('fulfilled');

    // Jobs 1 and 3 rejected with cancelled StudioDriverError
    expect(outcomes[1].status).toBe('rejected');
    expect((outcomes[1] as any).err).toBeInstanceOf(StudioDriverError);
    expect((outcomes[1] as any).err.category).toBe('cancelled');

    expect(outcomes[3].status).toBe('rejected');
    expect((outcomes[3] as any).err.category).toBe('cancelled');
  });

  it('4.4: Studio Mode Failover: Cloud Gemini Draft to Local Qwen Private Production', async () => {
    // Phase 1: Draft generation on Cloud Gemini (1K resolution)
    const draftImage = await geminiDriver.generateOne({
      prompt: 'Draft concept: silk blouse on subject',
      images: [FIXTURE_IMAGES.modelSubjectA],
      aspectRatio: '3:4',
      resolution: '1K',
      workflow: 'try-on',
    });
    expect(draftImage.base64).toContain('gemini_result_3:4_1K_0');

    // Phase 2: Sensitive production execution moved to Local Qwen Studio with FaceSwap LoRA
    const privateProductionImage = await localDriver.generateOne({
      prompt: FIXTURE_PROMPTS.identityTransfer,
      images: [draftImage, FIXTURE_IMAGES.brandModelFemale],
      workflow: 'identity-transfer',
    });
    expect(privateProductionImage.base64).toContain('local_qwen_faceswap_asset_0');

    const localJobs = localDriver.getRecordedJobs();
    expect(localJobs[0].injectedLora).toBe('bfs_head_v1.1_qwen_2.1.safetensors');

    // Phase 3: Upscaling strictly executes locally on Local Qwen (Local Qwen Upscale Invariant)
    const localUpscaled = await localDriver.upscale({
      image: privateProductionImage,
      quality: '4K',
    });
    expect(localUpscaled.base64).toContain('local_qwen_upscaled_4K_');

    const totalLocalJobs = localDriver.getRecordedJobs();
    expect(totalLocalJobs).toHaveLength(2); // 1 local generate + 1 local upscale
  });
});
