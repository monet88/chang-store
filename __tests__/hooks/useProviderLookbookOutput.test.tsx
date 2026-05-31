import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useProviderLookbookOutput, ProviderLookbookOutputCallbacks } from '@/hooks/useProviderLookbookOutput';
import { ImageFile } from '@/types';

const t = (key: string) => key;
const img = (tag: string): ImageFile => ({ base64: tag, mimeType: 'image/png' });

const makeCallbacks = (over: Partial<ProviderLookbookOutputCallbacks> = {}): ProviderLookbookOutputCallbacks => ({
  generateVariations: vi.fn(async (_b, count) => Array.from({ length: count }, (_, i) => img(`var-${i}`))),
  generateCloseUps: vi.fn(async () => [img('close-0'), img('close-1')]),
  refine: vi.fn(async (_b, instruction) => img(`refined-${instruction}`)),
  ...over,
});

describe('useProviderLookbookOutput', () => {
  it('seeds main from setMain and clears derived output', () => {
    const { result } = renderHook(() => useProviderLookbookOutput(makeCallbacks(), { maxVariations: 4 }, t));
    act(() => result.current.setMain(img('main')));
    expect(result.current.main?.base64).toBe('main');
    expect(result.current.variations).toEqual([]);
    expect(result.current.versions).toEqual([]);
  });

  it('generates variations capped at maxVariations', async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() => useProviderLookbookOutput(callbacks, { maxVariations: 1 }, t));
    act(() => result.current.setMain(img('main')));
    act(() => result.current.setVariationCount(4)); // request 4 but cap is 1

    await act(async () => {
      await result.current.generateVariations();
    });

    await waitFor(() => expect(result.current.variations).toHaveLength(1));
    expect(callbacks.generateVariations).toHaveBeenCalledWith(expect.objectContaining({ base64: 'main' }), 1, undefined);
  });

  it('generates close-ups', async () => {
    const { result } = renderHook(() => useProviderLookbookOutput(makeCallbacks(), { maxVariations: 4 }, t));
    act(() => result.current.setMain(img('main')));

    await act(async () => {
      await result.current.generateCloseUps();
    });

    await waitFor(() => expect(result.current.closeUps).toHaveLength(2));
  });

  it('refine pushes a version, swaps main, and invalidates variations/close-ups', async () => {
    const { result } = renderHook(() => useProviderLookbookOutput(makeCallbacks(), { maxVariations: 4 }, t));
    act(() => result.current.setMain(img('main')));
    await act(async () => { await result.current.generateCloseUps(); });

    await act(async () => {
      await result.current.refine('warmer');
    });

    expect(result.current.versions).toHaveLength(1);
    expect(result.current.main?.base64).toBe('refined-warmer');
    expect(result.current.selectedVersionIndex).toBe(0);
    expect(result.current.closeUps).toEqual([]);
  });

  it('selectVersion steps back to original and forward to a refined version', async () => {
    const { result } = renderHook(() => useProviderLookbookOutput(makeCallbacks(), { maxVariations: 4 }, t));
    act(() => result.current.setMain(img('original')));
    await act(async () => { await result.current.refine('v1'); });

    act(() => result.current.selectVersion(-1));
    expect(result.current.main?.base64).toBe('original');

    act(() => result.current.selectVersion(0));
    expect(result.current.main?.base64).toBe('refined-v1');
  });

  it('reset clears all output state', async () => {
    const { result } = renderHook(() => useProviderLookbookOutput(makeCallbacks(), { maxVariations: 4 }, t));
    act(() => result.current.setMain(img('main')));
    await act(async () => { await result.current.refine('x'); });

    act(() => result.current.reset());

    expect(result.current.main).toBeNull();
    expect(result.current.versions).toEqual([]);
    expect(result.current.selectedVersionIndex).toBe(-1);
  });
});
