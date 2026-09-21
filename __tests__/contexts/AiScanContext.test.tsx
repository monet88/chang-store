import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { AiScanProvider, useAiScan, AI_SCAN_MODEL } from '@/contexts/AiScanContext';
import { aiScanSourceSet } from '@/utils/ai-scan-blueprint';
import type { ImageFile } from '@/types';

const IMAGE_A: ImageFile = { base64: 'aaa', mimeType: 'image/png' };
const IMAGE_B: ImageFile = { base64: 'bbb', mimeType: 'image/jpeg' };

const wrapperFor = (
  analyze: (image: ImageFile, model?: string) => Promise<string>,
  initialEnabled?: boolean,
) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AiScanProvider analyze={analyze} initialEnabled={initialEnabled}>
        {children}
      </AiScanProvider>
    );
  };

describe('aiScanSourceSet', () => {
  const subject: ImageFile = { base64: 'subject', mimeType: 'image/png' };
  const items = (count: number): ImageFile[] =>
    Array.from({ length: count }, (_, index) => ({ base64: `item-${index}`, mimeType: 'image/jpeg' }));

  it('keeps the feature images first and reserves a slot for the shared reference', () => {
    const garments = items(4);

    expect(aiScanSourceSet(garments, [subject])).toEqual([garments[0], garments[1], garments[2], subject]);
  });

  it('scans every item when there is no shared reference', () => {
    const garments = items(6);

    expect(aiScanSourceSet(garments, [])).toEqual(garments.slice(0, 4));
  });

  it('counts only usable images and one shared reference', () => {
    const legacy = { base64: 'legacy', mimeType: 'image/png' };

    expect(aiScanSourceSet([legacy, null, undefined], [subject, IMAGE_B])).toEqual([legacy, subject]);
  });
});

describe('AiScanContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('without a provider', () => {
    it('is inert so features keep generating from their base prompt', async () => {
      const { result } = renderHook(() => useAiScan());

      expect(result.current.enabled).toBe(false);
      await expect(result.current.scan([IMAGE_A])).resolves.toBeNull();
    });
  });

  describe('preference', () => {
    it('defaults to ON and persists the toggle', () => {
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(vi.fn()) });

      expect(result.current.enabled).toBe(true);

      act(() => result.current.setEnabled(false));

      expect(result.current.enabled).toBe(false);
      expect(localStorage.getItem('ai_scan_enabled')).toBe('false');
    });

    it('restores the stored OFF preference', () => {
      localStorage.setItem('ai_scan_enabled', 'false');

      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(vi.fn()) });

      expect(result.current.enabled).toBe(false);
    });
  });

  describe('scan', () => {
    it('resolves the blueprint, pinning the model standard', async () => {
      const analyze = vi.fn().mockResolvedValue('WEAVE & MATERIAL: plissé accordion pleats.');
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprint: string | null = null;
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A]);
      });

      expect(blueprint).toBe('WEAVE & MATERIAL: plissé accordion pleats.');
      expect(analyze).toHaveBeenCalledWith(IMAGE_A, AI_SCAN_MODEL);
    });

    it('analyzes once for the same source set and reuses that analysis', async () => {
      const analyze = vi.fn().mockResolvedValue('blueprint');
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      await act(async () => {
        await result.current.scan([IMAGE_A, IMAGE_B]);
        await result.current.scan([IMAGE_A, IMAGE_B]);
      });

      // One analysis per source image, reused by the second scan of the set.
      expect(analyze).toHaveBeenCalledTimes(2);
    });

    it('labels each report so the model knows which image it came from', async () => {
      const analyze = vi.fn(async (image: ImageFile) => (image === IMAGE_A ? 'top: satin' : 'bottom: denim'));
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprint: string | null = null;
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A, IMAGE_B]);
      });

      expect(blueprint).toContain('top: satin');
      expect(blueprint).toContain('bottom: denim');
      expect(blueprint).toContain('SOURCE IMAGE 2');
    });

    it('ignores sources past the analysis limit', async () => {
      const analyze = vi.fn().mockResolvedValue('blueprint');
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });
      const many: ImageFile[] = Array.from({ length: 6 }, (_, index) => ({
        base64: `image-${index}`,
        mimeType: 'image/png',
      }));

      await act(async () => {
        await result.current.scan(many);
      });

      expect(analyze).toHaveBeenCalledTimes(4);
    });

    it('skips analysis entirely when the layer is OFF', async () => {
      const analyze = vi.fn().mockResolvedValue('blueprint');
      const { result } = renderHook(() => useAiScan(), {
        wrapper: wrapperFor(analyze, false),
      });

      let blueprint: string | null = 'unset';
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A]);
      });

      expect(blueprint).toBeNull();
      expect(analyze).not.toHaveBeenCalled();
    });

    it('does not analyze an empty source list', async () => {
      const analyze = vi.fn().mockResolvedValue('blueprint');
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprint: string | null = 'unset';
      await act(async () => {
        blueprint = await result.current.scan([]);
      });

      expect(blueprint).toBeNull();
      expect(analyze).not.toHaveBeenCalled();
    });

    it('fails closed: one failed source voids the whole blueprint', async () => {
      const analyze = vi.fn(async (image: ImageFile) => {
        if (image === IMAGE_B) throw new Error('one image failed');
        return 'top: satin';
      });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprint: string | null = 'unset';
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A, IMAGE_B]);
      });

      // A partial blueprint would state one garment's fabric while silently
      // dropping the other, so the run keeps its base prompt instead.
      expect(blueprint).toBeNull();
      consoleSpy.mockRestore();
    });

    it('fails closed on an unusable report', async () => {
      const analyze = vi.fn(async (image: ImageFile) => (image === IMAGE_B ? '   \n ' : 'top: satin'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprint: string | null = 'unset';
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A, IMAGE_B]);
      });

      expect(blueprint).toBeNull();
      consoleSpy.mockRestore();
    });

    it('falls back to the base prompt when every source fails, and retries later', async () => {
      const analyze = vi.fn().mockRejectedValue(new Error('gateway 502'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprint: string | null = 'unset';
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A]);
      });

      expect(blueprint).toBeNull();

      analyze.mockResolvedValue('recovered blueprint');
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A]);
      });

      // A failure is never cached: the same source set is analyzed again.
      expect(blueprint).toBe('recovered blueprint');
      expect(analyze).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('isolates source sets: scanning another set never evicts earlier analysis', async () => {
      const analyze = vi.fn(async (image: ImageFile) => `blueprint for ${image.base64}`);
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprintA: string | null = null;
      let blueprintB: string | null = null;
      let blueprintAReused: string | null = null;

      await act(async () => {
        blueprintA = await result.current.scan([IMAGE_A]);
        blueprintB = await result.current.scan([IMAGE_B]);
        blueprintAReused = await result.current.scan([IMAGE_A]);
      });

      expect(blueprintA).toBe('blueprint for aaa');
      expect(blueprintB).toBe('blueprint for bbb');
      expect(blueprintAReused).toBe('blueprint for aaa');
      // IMAGE_A was analyzed only once despite IMAGE_B scanning in between
      expect(analyze).toHaveBeenCalledTimes(2);
    });

    it('never invalidates an existing analysis when another job fails', async () => {
      const analyze = vi.fn(async (image: ImageFile) => {
        if (image === IMAGE_B) throw new Error('image B failure');
        return `blueprint for ${image.base64}`;
      });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprintA: string | null = null;
      let blueprintB: string | null = null;
      let blueprintAReused: string | null = null;

      await act(async () => {
        blueprintA = await result.current.scan([IMAGE_A]);
        blueprintB = await result.current.scan([IMAGE_B]);
        blueprintAReused = await result.current.scan([IMAGE_A]);
      });

      expect(blueprintA).toBe('blueprint for aaa');
      expect(blueprintB).toBeNull();
      expect(blueprintAReused).toBe('blueprint for aaa');
      expect(analyze).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('an empty source scan from another feature does not purge cached analyses', async () => {
      const analyze = vi.fn().mockResolvedValue('blueprint for aaa');
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprintA: string | null = null;
      let blueprintAReused: string | null = null;

      await act(async () => {
        blueprintA = await result.current.scan([IMAGE_A]);
        await result.current.scan([]);
        blueprintAReused = await result.current.scan([IMAGE_A]);
      });

      expect(blueprintA).toBe('blueprint for aaa');
      expect(blueprintAReused).toBe('blueprint for aaa');
      expect(analyze).toHaveBeenCalledTimes(1);
    });
  });
});
