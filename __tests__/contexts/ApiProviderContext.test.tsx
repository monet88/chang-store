/**
 * ApiProviderContext Unit Tests
 *
 * Tests for the ApiProvider and useApi hook.
 * Validates API context state management including:
 * - API key management (Google)
 * - Model selection and storage
 * - localStorage persistence for model selections (API key is memory-only)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { ApiProvider, useApi } from '@/contexts/ApiProviderContext';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

/** Mock setGeminiApiKey from apiClient */
const mockSetGeminiApiKey = vi.fn();

vi.mock('@/services/apiClient', () => ({
  setGeminiApiKey: (key: string | null) => mockSetGeminiApiKey(key),
}));

/** localStorage mock implementation */
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// -----------------------------------------------------------------------------
// Test Utilities
// -----------------------------------------------------------------------------

/**
 * Wrapper component that provides ApiProvider context.
 * Required for testing hooks that depend on the provider.
 */
const createWrapper = () => {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ApiProvider>{children}</ApiProvider>;
  };
};

// -----------------------------------------------------------------------------
// Test Suites
// -----------------------------------------------------------------------------

describe('ApiProviderContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useApi hook', () => {
    it('throws error when used outside ApiProvider', () => {
      // Suppress console.error for cleaner test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useApi());
      }).toThrow('useApi must be used within an ApiProvider');

      consoleSpy.mockRestore();
    });

    it('returns context value when used within provider', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(typeof result.current.setGoogleApiKey).toBe('function');
    });
  });

  describe('default values', () => {
    it('has correct default model values', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.imageEditModel).toBe('gemini-3.1-flash-image-preview');
      expect(result.current.imageGenerateModel).toBe('imagen-4.0-generate-001');
      expect(result.current.textGenerateModel).toBe('gemini-3-flash-preview');
    });

    it('has null Google API key by default', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.googleApiKey).toBeNull();
    });

    it('does not load Google API key from localStorage on mount', () => {
      localStorageMock.getItem.mockReturnValueOnce('stored-api-key');

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).not.toHaveBeenCalledWith('google_api_key');
      expect(result.current.googleApiKey).toBeNull();
    });

    it('loads model selections from localStorage on mount when valid', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'image_edit_model') return 'gemini-2.5-flash-image';
        if (key === 'image_generate_model') return 'imagen-custom-generate-model';
        if (key === 'text_generate_model') return 'gemini-2.5-flash';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('image_edit_model');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('image_generate_model');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('text_generate_model');
      expect(result.current.imageEditModel).toBe('gemini-2.5-flash-image');
      expect(result.current.imageGenerateModel).toBe('imagen-custom-generate-model');
      expect(result.current.textGenerateModel).toBe('gemini-2.5-flash');
    });

    it('falls back to default models if legacy local/anti models are found in localStorage', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'image_edit_model') return 'local-sdxl';
        if (key === 'image_generate_model') return 'anti-generate';
        if (key === 'text_generate_model') return 'llama-3';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.imageEditModel).toBe('gemini-3.1-flash-image-preview');
      expect(result.current.imageGenerateModel).toBe('imagen-4.0-generate-001');
      expect(result.current.textGenerateModel).toBe('gemini-3-flash-preview');
    });
  });

  describe('setGoogleApiKey', () => {
    it('keeps key in memory only when setting a value', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setGoogleApiKey('new-api-key');
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalledWith('google_api_key', 'new-api-key');
      expect(result.current.googleApiKey).toBe('new-api-key');
    });

    it('calls setGeminiApiKey from apiClient', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setGoogleApiKey('test-key');
      });

      expect(mockSetGeminiApiKey).toHaveBeenCalledWith('test-key');
    });

    it('clears in-memory key when setting null', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      // First set a key
      act(() => {
        result.current.setGoogleApiKey('temp-key');
      });

      // Then remove it
      act(() => {
        result.current.setGoogleApiKey(null);
      });

      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('google_api_key');
      expect(result.current.googleApiKey).toBeNull();
      expect(mockSetGeminiApiKey).toHaveBeenLastCalledWith(null);
    });
  });

  describe('model setters', () => {
    it('setImageEditModel updates imageEditModel', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('gemini-2.5-flash-image');
      });

      expect(result.current.imageEditModel).toBe('gemini-2.5-flash-image');
    });

    it('setImageGenerateModel updates imageGenerateModel', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageGenerateModel('imagen-4.0-ultra-generate-001');
      });

      expect(result.current.imageGenerateModel).toBe('imagen-4.0-ultra-generate-001');
    });

    it('setTextGenerateModel updates textGenerateModel', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setTextGenerateModel('gemini-2.5-flash');
      });

      expect(result.current.textGenerateModel).toBe('gemini-2.5-flash');
    });

    it('persists model selections to localStorage', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('gemini-2.5-flash-image');
        result.current.setImageGenerateModel('imagen-4.0-ultra-generate-001');
        result.current.setTextGenerateModel('gemini-2.5-flash');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_edit_model', 'gemini-2.5-flash-image');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_generate_model', 'imagen-4.0-ultra-generate-001');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('text_generate_model', 'gemini-2.5-flash');
    });
  });

  describe('combined operations', () => {
    it('handles multiple model updates correctly', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('edit-1');
        result.current.setImageGenerateModel('gen-1');
        result.current.setTextGenerateModel('text-1');
      });

      expect(result.current.imageEditModel).toBe('edit-1');
      expect(result.current.imageGenerateModel).toBe('gen-1');
      expect(result.current.textGenerateModel).toBe('text-1');
    });
  });
});
