import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualTryOnClothing } from '@/hooks/useVirtualTryOnClothing';
import * as typesafeService from '@/services/typesafeService';

vi.mock('@/services/typesafeService', () => ({
  classifyVirtualTryOnItemTypes: vi.fn(),
}));

describe('useVirtualTryOnClothing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with a single default clothing item', () => {
    const { result } = renderHook(() => useVirtualTryOnClothing());

    expect(result.current.clothingItems.length).toBe(1);
    expect(result.current.clothingItems[0].sourceItemType).toBe('clothing');
    expect(result.current.clothingItems[0].sourcePrompt).toBe('');
    expect(result.current.validClothingItems.length).toBe(0);
  });

  it('allows adding and removing clothing uploaders up to 4 items', () => {
    const { result } = renderHook(() => useVirtualTryOnClothing());

    act(() => result.current.addClothingUploader());
    act(() => result.current.addClothingUploader());
    act(() => result.current.addClothingUploader());
    act(() => result.current.addClothingUploader()); // Should be capped at 4

    expect(result.current.clothingItems.length).toBe(4);

    const secondId = result.current.clothingItems[1].id;
    act(() => result.current.removeClothingUploader(secondId));
    expect(result.current.clothingItems.length).toBe(3);
    expect(result.current.clothingItems.some((i) => i.id === secondId)).toBe(false);
  });

  it('handles source prompt and item type changes', () => {
    const { result } = renderHook(() => useVirtualTryOnClothing());
    const id = result.current.clothingItems[0].id;

    act(() => result.current.handleSourcePromptChange(id, 'Red handbag with chain'));
    act(() => result.current.handleSourceItemTypeChange(id, 'bag'));

    expect(result.current.clothingItems[0].sourcePrompt).toBe('Red handbag with chain');
    expect(result.current.clothingItems[0].sourceItemType).toBe('bag');
  });

  describe('autoDetectItemType', () => {
    it('returns error when item has no text and no fallback', async () => {
      const { result } = renderHook(() => useVirtualTryOnClothing());
      const id = result.current.clothingItems[0].id;

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.autoDetectItemType(id);
      });

      expect(res?.success).toBe(false);
      expect(res?.error).toBe('noText');
      expect(typesafeService.classifyVirtualTryOnItemTypes).not.toHaveBeenCalled();
    });

    it('classifies item and updates sourceItemType when confidence is high', async () => {
      const { result } = renderHook(() => useVirtualTryOnClothing());
      const id = result.current.clothingItems[0].id;

      act(() => result.current.handleSourcePromptChange(id, 'White leather sneakers'));

      vi.mocked(typesafeService.classifyVirtualTryOnItemTypes).mockResolvedValueOnce({
        [String(id)]: { type: 'shoes', confidence: 0.96 },
      });

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.autoDetectItemType(id);
      });

      expect(res?.success).toBe(true);
      expect(result.current.clothingItems[0].sourceItemType).toBe('shoes');
      expect(typesafeService.classifyVirtualTryOnItemTypes).toHaveBeenCalledWith([
        { id, text: 'White leather sneakers' },
      ]);
    });

    it('uses fallbackText when item sourcePrompt is empty', async () => {
      const { result } = renderHook(() => useVirtualTryOnClothing());
      const id = result.current.clothingItems[0].id;

      vi.mocked(typesafeService.classifyVirtualTryOnItemTypes).mockResolvedValueOnce({
        [String(id)]: { type: 'accessory', confidence: 0.88 },
      });

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.autoDetectItemType(id, 'Silver necklace');
      });

      expect(res?.success).toBe(true);
      expect(result.current.clothingItems[0].sourceItemType).toBe('accessory');
    });

    it('returns error when API call fails', async () => {
      const { result } = renderHook(() => useVirtualTryOnClothing());
      const id = result.current.clothingItems[0].id;

      act(() => result.current.handleSourcePromptChange(id, 'Black boots'));
      vi.mocked(typesafeService.classifyVirtualTryOnItemTypes).mockRejectedValueOnce(
        new Error('Network error'),
      );

      let res: { success: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.autoDetectItemType(id);
      });

      expect(res?.success).toBe(false);
      expect(res?.error).toBe('Network error');
      expect(result.current.clothingItems[0].sourceItemType).toBe('clothing'); // unchanged
    });
  });

  describe('autoDetectAllItemTypes', () => {
    it('returns error when no items have text', async () => {
      const { result } = renderHook(() => useVirtualTryOnClothing());

      let res: { detectedCount: number; error?: string } | undefined;
      await act(async () => {
        res = await result.current.autoDetectAllItemTypes();
      });

      expect(res?.detectedCount).toBe(0);
      expect(res?.error).toBe('noText');
    });

    it('classifies all items with text in a single batch request', async () => {
      const { result } = renderHook(() => useVirtualTryOnClothing());
      act(() => result.current.addClothingUploader());

      const [item1, item2] = result.current.clothingItems;
      act(() => result.current.handleSourcePromptChange(item1.id, 'Silk floral dress'));
      act(() => result.current.handleSourcePromptChange(item2.id, 'Leather tote bag'));

      vi.mocked(typesafeService.classifyVirtualTryOnItemTypes).mockResolvedValueOnce({
        [String(item1.id)]: { type: 'clothing', confidence: 0.99 },
        [String(item2.id)]: { type: 'bag', confidence: 0.95 },
      });

      let res: { detectedCount: number; error?: string } | undefined;
      await act(async () => {
        res = await result.current.autoDetectAllItemTypes();
      });

      expect(res?.detectedCount).toBe(2);
      expect(result.current.clothingItems[0].sourceItemType).toBe('clothing');
      expect(result.current.clothingItems[1].sourceItemType).toBe('bag');
      expect(typesafeService.classifyVirtualTryOnItemTypes).toHaveBeenCalledTimes(1);
    });
  });
});
