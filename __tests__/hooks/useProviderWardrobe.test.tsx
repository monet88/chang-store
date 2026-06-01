import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useProviderWardrobe, GenerateSet } from '@/hooks/useProviderWardrobe';
import { ImageFile } from '@/types';

const t = (key: string) => key;
const img = (tag: string): ImageFile => ({ base64: tag, mimeType: 'image/png' });
const CONFIG = { maxSets: 2, maxItemsPerSet: 4, concurrency: 1 };

describe('useProviderWardrobe', () => {
  it('starts with one empty set and respects the maxSets cap', () => {
    const { result } = renderHook(() => useProviderWardrobe(vi.fn(), CONFIG, t));

    expect(result.current.sets).toHaveLength(1);
    act(() => result.current.addSet());
    expect(result.current.sets).toHaveLength(2);
    // Capped at maxSets = 2.
    act(() => result.current.addSet());
    expect(result.current.sets).toHaveLength(2);
  });

  it('adds, updates, and removes items within a set', () => {
    const { result } = renderHook(() => useProviderWardrobe(vi.fn(), CONFIG, t));
    const setId = result.current.sets[0].id;

    act(() => result.current.addItem(setId));
    const itemId = result.current.sets[0].items[0].id;
    act(() => result.current.updateItem(setId, itemId, { image: img('a'), sourceItemType: 'shoes' }));

    expect(result.current.sets[0].items[0].image?.base64).toBe('a');
    expect(result.current.sets[0].items[0].sourceItemType).toBe('shoes');

    act(() => result.current.removeItem(setId, itemId));
    expect(result.current.sets[0].items).toHaveLength(0);
  });

  it('requires a subject before generating', async () => {
    const generateSet = vi.fn();
    const { result } = renderHook(() => useProviderWardrobe(generateSet, CONFIG, t));

    await act(async () => {
      await result.current.generate();
    });

    expect(generateSet).not.toHaveBeenCalled();
    expect(result.current.error).toBe('studio.workflows.wardrobe.subjectRequired');
  });

  it('generates one batch per valid set and groups results', async () => {
    const generateSet: GenerateSet = vi.fn(async (_subject, items) => [img(`out-${items.length}`)]);
    const { result } = renderHook(() => useProviderWardrobe(generateSet, CONFIG, t));

    const setId = result.current.sets[0].id;
    act(() => result.current.setSubject(img('subject')));
    act(() => result.current.addItem(setId));
    const itemId = result.current.sets[0].items[0].id;
    act(() => result.current.updateItem(setId, itemId, { image: img('clothing') }));

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0].status).toBe('completed');
    expect(result.current.results[0].results[0].base64).toBe('out-1');
    expect(generateSet).toHaveBeenCalledTimes(1);
  });

  it('passes the wardrobe-owned prompts into generateSet', async () => {
    const generateSet: GenerateSet = vi.fn(async () => [img('out')]);
    const { result } = renderHook(() => useProviderWardrobe(generateSet, CONFIG, t));

    const setId = result.current.sets[0].id;
    act(() => result.current.setSubject(img('subject')));
    act(() => result.current.setBackgroundPrompt('beach'));
    act(() => result.current.setExtraPrompt('roll sleeves'));
    act(() => result.current.addItem(setId));
    const itemId = result.current.sets[0].items[0].id;
    act(() => result.current.updateItem(setId, itemId, { image: img('clothing') }));

    await act(async () => {
      await result.current.generate();
    });

    expect(generateSet).toHaveBeenCalledWith(
      expect.objectContaining({ base64: 'subject' }),
      expect.any(Array),
      { backgroundPrompt: 'beach', extraPrompt: 'roll sleeves' },
      undefined,
    );
  });

  it('reset returns to a single empty set and clears state', () => {
    const { result } = renderHook(() => useProviderWardrobe(vi.fn(), CONFIG, t));

    act(() => {
      result.current.addSet();
      result.current.setSubject(img('subject'));
      result.current.setBackgroundPrompt('bg');
    });
    act(() => result.current.reset());

    expect(result.current.sets).toHaveLength(1);
    expect(result.current.subject).toBeNull();
    expect(result.current.backgroundPrompt).toBe('');
  });
});
