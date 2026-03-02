/**
 * ApiProviderContext Unit Tests
 *
 * Tests for the ApiProvider and useApi hook.
 * Validates API context state management including:
 * - API key management (Google, Local)
 * - Model selection and storage
 * - Feature-based model routing logic
 * - localStorage persistence for Google API key and model selections
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { ApiProvider, useApi } from '@/contexts/ApiProviderContext';
import { Feature } from '@/types';

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
      expect(typeof result.current.setLocalApiBaseUrl).toBe('function');
      expect(typeof result.current.setLocalApiKey).toBe('function');
      expect(typeof result.current.getModelsForFeature).toBe('function');
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

    it('has null for API keys initially', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.googleApiKey).toBeNull();
      expect(result.current.localApiBaseUrl).toBeNull();
      expect(result.current.localApiKey).toBeNull();
    });

    it('loads Google API key from localStorage on mount', () => {
      localStorageMock.getItem.mockReturnValueOnce('stored-api-key');

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('google_api_key');
      expect(result.current.googleApiKey).toBe('stored-api-key');
    });

    it('loads Local provider settings from localStorage on mount', () => {
      localStorageMock.getItem
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('http://localhost:8317')
        .mockReturnValueOnce('local-key');

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('local_provider_base_url');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('local_provider_api_key');
      expect(result.current.localApiBaseUrl).toBe('http://localhost:8317');
      expect(result.current.localApiKey).toBe('local-key');
    });

    it('loads model selections from localStorage on mount', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'image_edit_model') return 'gemini-2.5-flash-image';
        if (key === 'image_generate_model') return 'custom-generate-model';
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
      expect(result.current.imageGenerateModel).toBe('custom-generate-model');
      expect(result.current.textGenerateModel).toBe('gemini-2.5-flash');
    });
  });

  describe('local provider storage', () => {
    it('loads local provider config from localStorage on mount', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'local_provider_base_url') return 'http://localhost:8317';
        if (key === 'local_provider_api_key') return 'proxypal-local';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('local_provider_base_url');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('local_provider_api_key');
      expect(result.current.localApiBaseUrl).toBe('http://localhost:8317');
      expect(result.current.localApiKey).toBe('proxypal-local');
    });

    it('persists local provider base URL to localStorage', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLocalApiBaseUrl('http://localhost:8317');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('local_provider_base_url', 'http://localhost:8317');
      expect(result.current.localApiBaseUrl).toBe('http://localhost:8317');
    });

    it('persists local provider API key to localStorage', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLocalApiKey('proxypal-local');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('local_provider_api_key', 'proxypal-local');
      expect(result.current.localApiKey).toBe('proxypal-local');
    });

    it('removes local provider values when setting null', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLocalApiBaseUrl('http://localhost:8317');
        result.current.setLocalApiKey('proxypal-local');
      });

      act(() => {
        result.current.setLocalApiBaseUrl(null);
        result.current.setLocalApiKey(null);
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('local_provider_base_url');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('local_provider_api_key');
      expect(result.current.localApiBaseUrl).toBeNull();
      expect(result.current.localApiKey).toBeNull();
    });
  });

  describe('setGoogleApiKey', () => {
    it('persists key to localStorage when setting a value', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setGoogleApiKey('new-api-key');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('google_api_key', 'new-api-key');
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

    it('removes key from localStorage when setting null', () => {
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

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('google_api_key');
      expect(result.current.googleApiKey).toBeNull();
      expect(mockSetGeminiApiKey).toHaveBeenLastCalledWith(null);
    });
  });

  describe('local provider setters', () => {
    it('setLocalApiBaseUrl persists trimmed url and updates state', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLocalApiBaseUrl('  http://localhost:8317  ');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('local_provider_base_url', 'http://localhost:8317');
      expect(result.current.localApiBaseUrl).toBe('http://localhost:8317');
    });

    it('setLocalApiBaseUrl removes storage when cleared', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLocalApiBaseUrl('http://localhost:8317');
        result.current.setLocalApiBaseUrl(null);
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('local_provider_base_url');
      expect(result.current.localApiBaseUrl).toBeNull();
    });

    it('setLocalApiKey persists trimmed key and updates state', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLocalApiKey('  local-key  ');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('local_provider_api_key', 'local-key');
      expect(result.current.localApiKey).toBe('local-key');
    });

    it('setLocalApiKey removes storage when cleared', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLocalApiKey('local-key');
        result.current.setLocalApiKey(null);
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('local_provider_api_key');
      expect(result.current.localApiKey).toBeNull();
    });
  });

  describe('model setters', () => {
    it('setImageEditModel updates imageEditModel', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('local--custom-edit');
      });

      expect(result.current.imageEditModel).toBe('local--custom-edit');
    });

    it('setImageGenerateModel updates imageGenerateModel', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageGenerateModel('custom-generate-model');
      });

      expect(result.current.imageGenerateModel).toBe('custom-generate-model');
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
        result.current.setImageEditModel('local--custom-edit');
        result.current.setImageGenerateModel('custom-generate-model');
        result.current.setTextGenerateModel('gemini-2.5-flash');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_edit_model', 'local--custom-edit');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_generate_model', 'custom-generate-model');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('text_generate_model', 'gemini-2.5-flash');
    });
  });

  describe('getModelsForFeature', () => {
    it('returns unchanged models for TryOn feature', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      const models = result.current.getModelsForFeature(Feature.TryOn);

      expect(models.imageEditModel).toBe('gemini-3.1-flash-image-preview');
      expect(models.imageGenerateModel).toBe('imagen-4.0-generate-001');
      expect(models.textGenerateModel).toBe('gemini-3-flash-preview');
    });

    it('returns unchanged models for Background feature', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('custom-edit');
      });

      const models = result.current.getModelsForFeature(Feature.Background);

      expect(models.imageEditModel).toBe('custom-edit');
    });

    it('returns unchanged models for Upscale feature', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      const models = result.current.getModelsForFeature(Feature.Upscale);

      expect(models.imageEditModel).toBe('gemini-3.1-flash-image-preview');
    });

    it('returns unchanged models for Lookbook feature', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('updated-edit');
      });

      const models = result.current.getModelsForFeature(Feature.Lookbook);

      expect(models.imageEditModel).toBe('updated-edit');
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

    it('getModelsForFeature returns current state after updates', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('updated-edit');
      });

      const models = result.current.getModelsForFeature(Feature.Lookbook);
      expect(models.imageEditModel).toBe('updated-edit');
    });
  });
});
