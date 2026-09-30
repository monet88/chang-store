import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  InMemoryImageDriverFake,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_REFERENCES, FIXTURE_PROMPTS } from '../harness/testFixtures';
import { UNTUCKED_DRAPE_INSTRUCTION } from '@/utils/outfitDrapePolicy';

describe('Tier 1: Feature 8 - Clothing Transfer & E-Com Pack (clothing-transfer)', () => {
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

  it('8.1: transfers clothing on Gemini with 3:4 aspect ratio and 2K resolution', async () => {
    const results = await geminiDriver.generate({
      prompt: FIXTURE_PROMPTS.clothingTransfer,
      references: FIXTURE_REFERENCES.clothingTransferECom,
      aspectRatio: '3:4',
      resolution: '2K',
      workflow: 'clothing-transfer',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gemini_result_3:4_2K_0');

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].workflow).toBe('clothing-transfer');
  });

  it('8.2: transfers clothing on GPT Image with 3:4 ratio mapping to 1024x1536', async () => {
    const results = await gptDriver.generate({
      prompt: FIXTURE_PROMPTS.clothingTransfer,
      images: [
        FIXTURE_IMAGES.modelSubjectA,
        FIXTURE_IMAGES.woolBlazerOuterwear,
        FIXTURE_IMAGES.brandModelFemale,
      ],
      aspectRatio: '3:4',
      workflow: 'clothing-transfer',
      negativePrompt: 'misaligned sleeves, color bleeding, warped buttons',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gpt_image_1024x1536_0');

    const recorded = gptDriver.getRecordedJobs();
    expect(recorded[0].resolvedDimensions).toBe('1024x1536');
  });

  it('8.3: executes clothing transfer safely on Local Qwen driver', async () => {
    const results = await localDriver.generate({
      prompt: FIXTURE_PROMPTS.clothingTransfer,
      images: [FIXTURE_IMAGES.modelSubjectA, FIXTURE_IMAGES.woolBlazerOuterwear],
      workflow: 'clothing-transfer',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('local_qwen_asset_0');
  });

  it('8.4: generates complete E-Com Pack bundle (Flat Lay, Hanger, Brand Model)', async () => {
    const bundleTasks = [
      { template: 'Flat Lay', ratio: '1:1' as const, image: FIXTURE_IMAGES.flatLayTemplate },
      { template: 'Hanger', ratio: '3:4' as const, image: FIXTURE_IMAGES.hangerTemplate },
      { template: 'Brand Model', ratio: '3:4' as const, image: FIXTURE_IMAGES.brandModelFemale },
    ];

    const results = await Promise.all(
      bundleTasks.map((task) =>
        fakeDriver.generateOne({
          prompt: `E-Com Pack: Render garment on ${task.template} staging template`,
          references: [
            { image: FIXTURE_IMAGES.woolBlazerOuterwear, role: 'garment', label: 'Product Garment' },
            { image: task.image, role: 'style', label: `${task.template} Staging` },
          ],
          aspectRatio: task.ratio,
          workflow: 'clothing-transfer',
        })
      )
    );

    expect(results).toHaveLength(3);
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded).toHaveLength(3);
    expect(recorded[0].aspectRatio).toBe('1:1');
    expect(recorded[1].aspectRatio).toBe('3:4');
  });

  it('8.5: preserves bifurcated trousers construction in garment transfer', async () => {
    const result = await fakeDriver.generateOne({
      prompt: 'Transfer navy tailored trousers: enforce bifurcated two-leg construction with separate ankle openings',
      references: [
        { image: FIXTURE_IMAGES.modelSubjectA, role: 'subject', label: 'Source model' },
        { image: FIXTURE_IMAGES.tailoredTrousersBottom, role: 'garment', label: 'Bifurcated bottom' },
      ],
      workflow: 'clothing-transfer',
    });

    expect(result).toBeDefined();
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].prompt).toContain('bifurcated');
  });

  it('8.6: strictly enforces Outfit Drape Invariant (tops remain untucked outside waistband)', async () => {
    await geminiDriver.generate({
      prompt: 'Transfer cream blouse onto target model',
      workflow: 'clothing-transfer',
    });

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].prompt).toContain(UNTUCKED_DRAPE_INSTRUCTION);
  });
});
