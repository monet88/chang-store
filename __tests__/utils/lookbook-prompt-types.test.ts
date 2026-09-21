import { describe, expect, it } from 'vitest';
import type { ImageFile } from '@/types';
import {
  lookbookAiScanSources,
  buildCloseUpNegativePrompt,
} from '@/utils/lookbook-prompt-types';

const mockImage = (id: string): ImageFile => ({
  base64: `mock-base64-${id}`,
  mimeType: 'image/png',
});

describe('lookbookAiScanSources', () => {
  const slots = (count: number): Array<{ id: string; image: ImageFile | null }> =>
    Array.from({ length: count }, (_, index) => ({ id: String(index), image: mockImage(`garment-${index}`) }));
  const fabric = mockImage('fabric-texture');

  it('reserves a scan slot for the fabric texture when the clothing list fills the limit', () => {
    const clothing = slots(6);

    expect(lookbookAiScanSources(clothing, fabric)).toEqual([
      clothing[0].image,
      clothing[1].image,
      clothing[2].image,
      fabric,
    ]);
  });

  it('keeps the slot order and appends the fabric texture last', () => {
    const clothing = slots(2);

    expect(lookbookAiScanSources(clothing, fabric)).toEqual([
      clothing[0].image,
      clothing[1].image,
      fabric,
    ]);
  });

  it('ignores empty slots and a missing fabric texture', () => {
    const clothing = [{ id: '1', image: mockImage('garment') }, { id: '2', image: null }];

    expect(lookbookAiScanSources(clothing, null)).toEqual([clothing[0].image]);
  });
});

describe('buildCloseUpNegativePrompt', () => {
  it('combines base negative prompt with targeted close-up avoid guidance', () => {
    const combined = buildCloseUpNegativePrompt('no blur, no grain');
    expect(combined).toContain('no blur, no grain');
    expect(combined).toContain('invented buttons, invented pockets, invented trims, invented collars');
  });

  it('works when base negative prompt is empty', () => {
    const combined = buildCloseUpNegativePrompt('');
    expect(combined).toBe('invented buttons, invented pockets, invented trims, invented collars, incorrect stitching, distorted proportions, blurry details, fabric warping, color shift, fake logos, watermark, background clutter');
  });
});
