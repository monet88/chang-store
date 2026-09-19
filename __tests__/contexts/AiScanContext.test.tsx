import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AiScanProvider, useAiScan, AI_SCAN_MODEL } from '@/contexts/AiScanContext';
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

describe('AiScanContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('without a provider', () => {
    it('is inert so features keep generating from their base prompt', async () => {
      const { result } = renderHook(() => useAiScan());

      expect(result.current.enabled).toBe(false);
      expect(result.current.blueprint).toBeNull();
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
    it('resolves the blueprint and exposes it, pinning the model standard', async () => {
      const analyze = vi.fn().mockResolvedValue('WEAVE & MATERIAL: plissé accordion pleats.');
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprint: string | null = null;
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A]);
      });

      expect(blueprint).toBe('WEAVE & MATERIAL: plissé accordion pleats.');
      expect(result.current.blueprint).toBe('WEAVE & MATERIAL: plissé accordion pleats.');
      expect(analyze).toHaveBeenCalledWith(IMAGE_A, AI_SCAN_MODEL);
      expect(result.current.isAnalyzing).toBe(false);
    });

    it('analyzes once for the same source set and reuses that analysis', async () => {
      const analyze = vi.fn().mockResolvedValue('blueprint');
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      await act(async () => {
        await result.current.scan([IMAGE_A, IMAGE_B]);
        await result.current.scan([IMAGE_A, IMAGE_B]);
      });

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

    it('drops the previous blueprint when the source set changes', async () => {
      const analyze = vi.fn().mockResolvedValue('first blueprint');
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      await act(async () => {
        await result.current.scan([IMAGE_A]);
      });
      expect(result.current.blueprint).toBe('first blueprint');

      let resolveSecond: (value: string) => void = () => {};
      analyze.mockImplementationOnce(
        () => new Promise<string>((resolve) => { resolveSecond = resolve; }),
      );

      let pending: Promise<string | null> | null = null;
      await act(async () => {
        pending = result.current.scan([IMAGE_B]);
        await Promise.resolve();
      });

      // The blueprint of the images the user just replaced is gone, not shown
      // next to the analysis of the new set.
      expect(result.current.blueprint).toBeNull();

      await act(async () => {
        resolveSecond('second blueprint');
        await pending;
      });

      expect(result.current.blueprint).toBe('second blueprint');
    });

    it('clears the blueprint when the sources are emptied', async () => {
      const analyze = vi.fn().mockResolvedValue('blueprint');
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      await act(async () => {
        await result.current.scan([IMAGE_A]);
      });
      await act(async () => {
        await result.current.scan([]);
      });

      expect(result.current.blueprint).toBeNull();
    });

    it('falls back to the base prompt when analysis fails, and retries later', async () => {
      const analyze = vi.fn().mockRejectedValue(new Error('gateway 502'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprint: string | null = 'unset';
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A]);
      });

      expect(blueprint).toBeNull();
      expect(result.current.error).toBe('gateway 502');

      analyze.mockResolvedValue('recovered blueprint');
      await act(async () => {
        await result.current.scan([IMAGE_A]);
      });

      expect(result.current.blueprint).toBe('recovered blueprint');
      expect(analyze).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('keeps the reports of the sources that answered', async () => {
      const analyze = vi.fn(async (image: ImageFile) => {
        if (image === IMAGE_B) throw new Error('one image failed');
        return 'top: satin';
      });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let blueprint: string | null = null;
      await act(async () => {
        blueprint = await result.current.scan([IMAGE_A, IMAGE_B]);
      });

      expect(blueprint).toContain('top: satin');
      expect(result.current.blueprint).toContain('top: satin');
      consoleSpy.mockRestore();
    });

    it('flags the analyzing state while the analysis is in flight', async () => {
      let resolveAnalyze: (value: string) => void = () => {};
      const analyze = vi.fn(
        () => new Promise<string>((resolve) => { resolveAnalyze = resolve; }),
      );
      const { result } = renderHook(() => useAiScan(), { wrapper: wrapperFor(analyze) });

      let pending: Promise<string | null> | null = null;
      await act(async () => {
        pending = result.current.scan([IMAGE_A]);
        await Promise.resolve();
      });

      expect(result.current.isAnalyzing).toBe(true);

      await act(async () => {
        resolveAnalyze('blueprint');
        await pending;
      });

      await waitFor(() => expect(result.current.isAnalyzing).toBe(false));
    });
  });
});
