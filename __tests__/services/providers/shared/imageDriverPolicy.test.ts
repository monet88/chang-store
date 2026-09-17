import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  gatewayHostOf,
  parsePixelSize,
  resolveDriverPolicy,
  verifyReturnedDimensions,
} from '@/services/providers/shared/imageDriverPolicy';
import { getImageDimensions } from '@/utils/imageUtils';
import type * as imageUtilsModule from '@/utils/imageUtils';

vi.mock('@/utils/imageUtils', async (importOriginal) => ({
  ...(await importOriginal<typeof imageUtilsModule>()),
  getImageDimensions: vi.fn(),
}));

const dimensionsMock = vi.mocked(getImageDimensions);
const IMAGES = [{ base64: 'AAAA', mimeType: 'image/png' }];

/** console.log args reach the spy raw — objects must be stringified to be asserted on. */
const formatLogArg = (arg: unknown): string => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg));

describe('image driver policy', () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    localStorage.setItem('chang-store-debug', 'true');
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(formatLogArg).join(' '));
    });
    dimensionsMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads capabilities for the (gateway, model) pair and null for an unknown model', () => {
    const openAi = resolveDriverPolicy('gpt-image-2', 'https://api.openai.com/v1');
    const cpa = resolveDriverPolicy('gpt-image-2', 'https://cliproxy.monet.uno/v1');

    expect(openAi?.gatewayHost).toBe('api.openai.com');
    expect(openAi?.capabilities.honorsSize).toBe('yes');
    expect(cpa?.gatewayHost).toBe('cliproxy.monet.uno');
    expect(cpa?.capabilities.honorsSize).toBe('no');
    expect(resolveDriverPolicy('gpt-image-9-unknown', 'https://api.openai.com/v1')).toBeNull();
  });

  it('extracts a bare host from a base URL, including a non-default port', () => {
    expect(gatewayHostOf('https://cliproxy.monet.uno/v1')).toBe('cliproxy.monet.uno');
    expect(gatewayHostOf('http://localhost:5173/v1')).toBe('localhost:5173');
    expect(gatewayHostOf('not a url')).toBeUndefined();
  });

  it('parses a pixel size and refuses anything else', () => {
    expect(parsePixelSize('1080x1920')).toEqual({ width: 1080, height: 1920 });
    expect(parsePixelSize('auto')).toBeNull();
    expect(parsePixelSize('9:16')).toBeNull();
  });

  it('reports a silently different returned size, keeping the image', async () => {
    dimensionsMock.mockResolvedValue({ width: 1254, height: 1254 });
    const sunburst = resolveDriverPolicy('gpt-image-2.5-sunburst', 'https://api.xompet.io.vn/v1');

    const mismatch = await verifyReturnedDimensions(IMAGES, '1080x1920', sunburst!.capabilities, { modelId: 'gpt-image-2.5-sunburst' });

    expect(dimensionsMock).toHaveBeenCalledWith('AAAA', 'image/png');
    expect(logged.join('\n')).toContain('image.dimensionMismatch');
    expect(logged.join('\n')).toContain('1254x1254');
    expect(mismatch).toEqual({ requested: '1080x1920', returned: '1254x1254' });
  });

  it('stays silent when the requested size is honoured', async () => {
    dimensionsMock.mockResolvedValue({ width: 1080, height: 1920 });
    const sunburst = resolveDriverPolicy('gpt-image-2.5-sunburst', 'https://api.xompet.io.vn/v1');

    const mismatch = await verifyReturnedDimensions(IMAGES, '1080x1920', sunburst!.capabilities, { modelId: 'gpt-image-2.5-sunburst' });

    expect(logged.join('\n')).not.toContain('image.dimensionMismatch');
    expect(mismatch).toBeNull();
  });

  it('always verifies a flaky gateway, never a gateway that ignores size', async () => {
    const flaky = resolveDriverPolicy('gpt-image-2.5-sunburst', 'https://api.xompet.io.vn/v1');
    dimensionsMock.mockResolvedValue({ width: 1080, height: 1920 });
    await verifyReturnedDimensions(IMAGES, '1080x1920', flaky!.capabilities, { modelId: 'x' });
    expect(dimensionsMock).toHaveBeenCalledTimes(1);

    dimensionsMock.mockClear();
    const ignoresSize = resolveDriverPolicy('gpt-image-2', 'https://cliproxy.monet.uno/v1');
    await verifyReturnedDimensions(IMAGES, '1024x1024', ignoresSize!.capabilities, { modelId: 'gpt-image-2' });
    expect(dimensionsMock).not.toHaveBeenCalled();
  });

  it('skips the check for a non-pixel driver and for the auto size', async () => {
    const gemini = resolveDriverPolicy('gemini-3.1-flash-image', 'https://cliproxy.monet.uno');
    dimensionsMock.mockResolvedValue({ width: 1, height: 1 });

    await verifyReturnedDimensions(IMAGES, '1024x1024', gemini!.capabilities, { modelId: 'gemini-3.1-flash-image' });
    await verifyReturnedDimensions(IMAGES, 'auto', resolveDriverPolicy('gpt-image-2', 'https://api.openai.com/v1')!.capabilities, { modelId: 'gpt-image-2' });

    expect(dimensionsMock).not.toHaveBeenCalled();
  });

  it('never fails a generation because dimensions could not be read', async () => {
    dimensionsMock.mockRejectedValue(new Error('Could not determine image dimensions.'));
    const policy = resolveDriverPolicy('gpt-image-2', 'https://api.openai.com/v1');

    await expect(
      verifyReturnedDimensions(IMAGES, '1024x1024', policy!.capabilities, { modelId: 'gpt-image-2' }),
    ).resolves.toBeNull();
    expect(logged.join('\n')).not.toContain('image.dimensionMismatch');
  });
});
