import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalQwenSettings } from '@/hooks/useLocalQwenSettings';
import { DEFAULT_LOCAL_QWEN_SETTINGS, loadLocalQwenSettings } from '@/config/localQwenSettings';

describe('useLocalQwenSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes state with persisted or default settings', () => {
    const { result } = renderHook(() => useLocalQwenSettings());

    expect(result.current.settings).toEqual(loadLocalQwenSettings());
    expect(result.current.settings.resolution).toBe(DEFAULT_LOCAL_QWEN_SETTINGS.resolution);
    expect(result.current.settings.steps).toBe(DEFAULT_LOCAL_QWEN_SETTINGS.steps);
  });

  it('updates React state with sanitized values returned by saveLocalQwenSettings', () => {
    const { result } = renderHook(() => useLocalQwenSettings());

    // Steps exceeds max (50) -> should be clamped to 50 in both React state and storage
    act(() => {
      result.current.updateSetting('steps', 9999 as unknown as number);
    });

    expect(result.current.settings.steps).toBe(50);
    expect(loadLocalQwenSettings().steps).toBe(50);

    // CFG below min (0.1) -> should be clamped to 0.1 in both React state and storage
    act(() => {
      result.current.updateSetting('cfg', -10 as unknown as number);
    });

    expect(result.current.settings.cfg).toBe(0.1);
    expect(loadLocalQwenSettings().cfg).toBe(0.1);

    // Valid resolution update
    act(() => {
      result.current.updateSetting('resolution', 768);
    });

    expect(result.current.settings.resolution).toBe(768);
    expect(loadLocalQwenSettings().resolution).toBe(768);
  });
});
