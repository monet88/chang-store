import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ImageFile } from '@/types';

const { editGptImage } = vi.hoisted(() => ({ editGptImage: vi.fn() }));

vi.mock('@/services/providers/gpt-image/gptImageService', () => ({ editGptImage }));

import { buildGptImageEngine, resolveSizeForRatio } from '@/services/providers/gpt-image/gptImageEngine';
import { PROVIDER_UPSCALE_PROMPTS } from '@/utils/provider-refine-prompt';

/** The sizes the XomPet reference gateway advertises for the GPT image models. */
const XOMPET_SIZES = ['1080x1920', '1536x1024', '1024x1024', '1024x1536'];

const IMAGE: ImageFile = { base64: 'AAAA', mimeType: 'image/png' };
const CREDENTIALS = { apiKey: 'k', baseUrl: 'https://gateway.test/v1' };

const apiConfig = { onStatusUpdate: () => {} };

describe('resolveSizeForRatio', () => {
  it('maps each offered ratio to the closest advertised size', () => {
    expect(resolveSizeForRatio(XOMPET_SIZES, '1:1')).toBe('1024x1024');
    expect(resolveSizeForRatio(XOMPET_SIZES, '9:16')).toBe('1080x1920');
    // 3:4 has no exact match here: 1024x1536 is the nearest honored size.
    expect(resolveSizeForRatio(XOMPET_SIZES, '3:4')).toBe('1024x1536');
    expect(resolveSizeForRatio(XOMPET_SIZES, '4:3')).toBe('1536x1024');
  });

  it('falls back to the product default size for a ratio the lane cannot express', () => {
    expect(resolveSizeForRatio(XOMPET_SIZES, 'Default')).toBe('1024x1024');
  });

  it('returns auto when the gateway advertises no pixel sizes', () => {
    expect(resolveSizeForRatio(['auto'], '1:1')).toBe('auto');
    expect(resolveSizeForRatio([], '1:1')).toBe('auto');
  });
});

describe('buildGptImageEngine', () => {
  beforeEach(() => {
    editGptImage.mockReset();
    editGptImage.mockResolvedValue([IMAGE]);
  });

  it('sends the size the requested ratio resolves to, plus the selected quality', async () => {
    const engine = buildGptImageEngine({
      model: 'gpt-image-2',
      quality: 'high',
      sizeOptions: XOMPET_SIZES,
      credentials: CREDENTIALS,
    });

    await engine.editImage({ images: [IMAGE], prompt: 'dress the model', aspectRatio: '3:4' }, 'ignored', apiConfig);

    expect(editGptImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-image-2', size: '1024x1536', quality: 'high' }),
      CREDENTIALS,
    );
  });

  it('upscales through one preservation edit at the largest quality', async () => {
    const engine = buildGptImageEngine({
      model: 'gpt-image-2',
      quality: 'low',
      sizeOptions: XOMPET_SIZES,
      credentials: CREDENTIALS,
    });

    const upscaled = await engine.upscaleImage(IMAGE, 'ignored', apiConfig, '4K');

    expect(upscaled).toBe(IMAGE);
    const [params] = editGptImage.mock.calls[0];
    expect(params.images).toEqual([IMAGE]);
    expect(params.prompt).toBe(PROVIDER_UPSCALE_PROMPTS['4K']);
    expect(params.quality).toBe('high');
  });
});
