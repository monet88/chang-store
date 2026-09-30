import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestDriver,
  GeminiImageDriverTestDouble,
  GptImageDriverTestDouble,
  LocalQwenImageDriverTestDouble,
  InMemoryImageDriverFake,
} from '../harness/testHarness';
import { FIXTURE_IMAGES, FIXTURE_PROMPTS } from '../harness/testFixtures';

describe('Tier 1: Feature 5 - Photo Album (photo-album)', () => {
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

  it('5.1: generates thematic album photo on Gemini with 3:4 ratio', async () => {
    const results = await geminiDriver.generate({
      prompt: FIXTURE_PROMPTS.photoAlbum,
      images: [FIXTURE_IMAGES.modelSubjectA],
      aspectRatio: '3:4',
      resolution: '2K',
      workflow: 'photo-album',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gemini_result_3:4_2K_0');

    const recorded = geminiDriver.getRecordedJobs();
    expect(recorded[0].workflow).toBe('photo-album');
  });

  it('5.2: generates album photo on GPT Image with high quality setting', async () => {
    const results = await gptDriver.generate({
      prompt: FIXTURE_PROMPTS.photoAlbum,
      images: [FIXTURE_IMAGES.modelSubjectA],
      aspectRatio: '1:1',
      quality: 'high',
      workflow: 'photo-album',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('gpt_image_1024x1024_0');

    const recorded = gptDriver.getRecordedJobs();
    expect(recorded[0].quality).toBe('high');
    expect(recorded[0].resolvedDimensions).toBe('1024x1024');
  });

  it('5.3: runs album photo synthesis on Local Qwen driver', async () => {
    const results = await localDriver.generate({
      prompt: FIXTURE_PROMPTS.photoAlbum,
      images: [FIXTURE_IMAGES.modelSubjectA],
      workflow: 'photo-album',
    });

    expect(results).toHaveLength(1);
    expect(results[0].base64).toContain('local_qwen_asset_0');
  });

  it('5.4: synthesizes batch of 4 album collection images in one job', async () => {
    const albumPages = await fakeDriver.generate({
      prompt: `${FIXTURE_PROMPTS.photoAlbum} - 4 distinct collection shots`,
      images: [FIXTURE_IMAGES.modelSubjectA],
      count: 4,
      workflow: 'photo-album',
    });

    expect(albumPages).toHaveLength(4);
    const recorded = fakeDriver.getRecordedJobs();
    expect(recorded[0].count).toBe(4);
  });

  it('5.5: upscales selected album hero image to 4K resolution', async () => {
    const heroImage = await fakeDriver.generateOne({
      prompt: FIXTURE_PROMPTS.photoAlbum,
      workflow: 'photo-album',
    });

    const upscaled = await fakeDriver.upscale({
      image: heroImage,
      quality: '4K',
    });

    expect(upscaled.base64).toContain('upscaled_4K_');
  });

  it('5.6: tracks status progression messages across album creation', async () => {
    const progressReports: string[] = [];
    await fakeDriver.generate({
      prompt: FIXTURE_PROMPTS.photoAlbum,
      workflow: 'photo-album',
      onProgress: (status) => progressReports.push(status),
    });

    expect(progressReports).toContain('Initializing generation...');
    expect(progressReports).toContain('Synthesizing image assets...');
    expect(progressReports).toContain('Complete');
  });
});
