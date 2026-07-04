import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendRefinement, createImageChatSession } = vi.hoisted(() => {
  const sendRefinement = vi.fn();
  const createImageChatSession = vi.fn((_model: string) => ({
    sendRefinement,
    getHistory: () => [],
    reset: () => {},
  }));

  return { sendRefinement, createImageChatSession };
});

vi.mock('@/services/imageEditingService', () => ({
  createImageChatSession: (model: string) => createImageChatSession(model),
}));

import { useImageRefinement } from '@/hooks/useImageRefinement';
import { ImageFile } from '@/types';

const IMG: ImageFile = { base64: 'IN', mimeType: 'image/png' };
const OUT: ImageFile = { base64: 'OUT', mimeType: 'image/png' };
const t = (key: string) => key;

const setup = () => {
  const setError = vi.fn();
  const { result } = renderHook(() =>
    useImageRefinement({ imageEditModel: 'gemini-3.1-flash-image', setError, t }),
  );
  return { result, setError };
};

describe('useImageRefinement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendRefinement.mockResolvedValue(OUT);
  });

  it('ignores empty prompts (no session created)', async () => {
    const { result } = setup();
    const apply = vi.fn();
    await act(async () => {
      await result.current.runRefine('a:0', '   ', IMG, apply);
    });
    expect(createImageChatSession).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it('creates one session per key, applies result, clears prompt, toggles busy', async () => {
    const { result, setError } = setup();
    const apply = vi.fn();

    await act(async () => {
      await result.current.runRefine('a:0', 'brighter', IMG, apply);
    });

    expect(createImageChatSession).toHaveBeenCalledTimes(1);
    expect(sendRefinement).toHaveBeenCalledWith('brighter', IMG);
    expect(apply).toHaveBeenCalledWith(OUT);
    expect(setError).toHaveBeenCalledWith(null);
    expect(result.current.isRefining['a:0']).toBe(false);

    // Second refine on the same key reuses the session.
    await act(async () => {
      await result.current.runRefine('a:0', 'again', IMG, apply);
    });
    expect(createImageChatSession).toHaveBeenCalledTimes(1);
  });

  it('surfaces refine errors through setError and resets busy', async () => {
    sendRefinement.mockRejectedValueOnce(new Error('error.api.failed'));
    const { result, setError } = setup();
    const apply = vi.fn();

    await act(async () => {
      await result.current.runRefine('a:0', 'brighter', IMG, apply);
    });

    expect(apply).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('error.api.failed');
    expect(result.current.isRefining['a:0']).toBe(false);
  });

  it('clearSessionsForPrefix drops only matching sessions', async () => {
    const { result } = setup();
    const apply = vi.fn();
    await act(async () => {
      await result.current.runRefine('item1:0', 'x', IMG, apply);
      await result.current.runRefine('item2:0', 'y', IMG, apply);
    });
    expect(createImageChatSession).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.clearSessionsForPrefix('item1');
    });

    // item1 session dropped → next refine recreates it; item2 reused.
    await act(async () => {
      await result.current.runRefine('item1:0', 'again', IMG, apply);
      await result.current.runRefine('item2:0', 'again', IMG, apply);
    });
    expect(createImageChatSession).toHaveBeenCalledTimes(3);
  });

  it('drops cached sessions when the model changes', async () => {
    const setError = vi.fn();
    const { result, rerender } = renderHook(
      ({ model }) => useImageRefinement({ imageEditModel: model, setError, t }),
      { initialProps: { model: 'gemini-3.1-flash-image' } },
    );
    const apply = vi.fn();

    await act(async () => {
      await result.current.runRefine('a:0', 'brighter', IMG, apply);
    });
    expect(createImageChatSession).toHaveBeenCalledTimes(1);

    // Same model → session reused, no new session.
    rerender({ model: 'gemini-3.1-flash-image' });
    await act(async () => {
      await result.current.runRefine('a:0', 'again', IMG, apply);
    });
    expect(createImageChatSession).toHaveBeenCalledTimes(1);

    // Model change → cached session dropped, next refine recreates it.
    rerender({ model: 'gemini-3-pro-image' });
    await act(async () => {
      await result.current.runRefine('a:0', 'again', IMG, apply);
    });
    expect(createImageChatSession).toHaveBeenCalledTimes(2);
    expect(createImageChatSession).toHaveBeenLastCalledWith('gemini-3-pro-image');
  });
});
