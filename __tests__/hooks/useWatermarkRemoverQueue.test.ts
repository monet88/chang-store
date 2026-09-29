import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatermarkRemoverQueue } from '@/hooks/useWatermarkRemoverQueue';
import { type ImageFile } from '@/types';

const mockImage = (id: string): ImageFile => ({
  base64: `data-${id}`,
  mimeType: 'image/png',
});

describe('useWatermarkRemoverQueue', () => {
  it('initializes with default concurrency 3', () => {
    const { result } = renderHook(() => useWatermarkRemoverQueue());
    expect(result.current.config.concurrency).toBe(3);
  });

  it('preserves the configured concurrency when images are uploaded', () => {
    const { result } = renderHook(() => useWatermarkRemoverQueue());

    // Upload 4 images -> configured concurrency untouched (stays at default 3)
    act(() => {
      result.current.addImages([mockImage('1'), mockImage('2'), mockImage('3'), mockImage('4')]);
    });
    expect(result.current.config.concurrency).toBe(3);
    expect(result.current.items).toHaveLength(4);

    // A user-chosen value also survives further uploads
    act(() => {
      result.current.setConcurrency(7);
    });
    act(() => {
      result.current.addImages(Array.from({ length: 8 }, (_, i) => mockImage(`more-${i}`)));
    });
    expect(result.current.config.concurrency).toBe(7);
    expect(result.current.items).toHaveLength(12);
  });

  it('allows manually setting concurrency between 1 and 10', () => {
    const { result } = renderHook(() => useWatermarkRemoverQueue());

    act(() => {
      result.current.setConcurrency(7);
    });
    expect(result.current.config.concurrency).toBe(7);

    // Clamps above 10
    act(() => {
      result.current.setConcurrency(15);
    });
    expect(result.current.config.concurrency).toBe(10);

    // Clamps below 1
    act(() => {
      result.current.setConcurrency(0);
    });
    expect(result.current.config.concurrency).toBe(1);
  });
});
