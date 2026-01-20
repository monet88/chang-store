/**
 * ApiProviderContext Unit Tests
 *
 * Tests for the ApiProvider and useApi hook.
 * Validates API context state management including:
 * - API key management (Google, AIVideoAuto)
 * - Model selection and storage
 * - Feature-based model routing logic
 * - localStorage persistence for Google API key
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { ApiProvider, useApi } from '@/contexts/ApiProviderContext';
import { Feature, AIVideoAutoModel } from '@/types';

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

/**
 * Creates a mock AIVideoAutoModel for testing.
 * @param id - Unique identifier for the model
 */
const createMockAIVideoAutoModel = (id: string): AIVideoAutoModel => ({
  id_base: id,
  name: `Mock Model ${id}`,
  server: 'test-server',
  model: `model-${id}`,
  price: 0.01,
  startText: true,
  startImage: true,
});

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
      expect(typeof result.current.setAivideoautoAccessToken).toBe('function');
      expect(typeof result.current.getModelsForFeature).toBe('function');
    });
  });

  describe('default values', () => {
    it('has correct default model values', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.imageEditModel).toBe('gemini-3-pro-image-preview');
      expect(result.current.imageGenerateModel).toBe('imagen-4.0-generate-001');
      expect(result.current.videoGenerateModel).toBe('');
      expect(result.current.textGenerateModel).toBe('gemini-3-flash-preview');
    });

    it('has null for API keys initially', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.googleApiKey).toBeNull();
      expect(result.current.localApiBaseUrl).toBeNull();
      expect(result.current.localApiKey).toBeNull();
      expect(result.current.aivideoautoAccessToken).toBeNull();
    });

    it('has empty arrays for AIVideoAuto models', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.aivideoautoImageModels).toEqual([]);
      expect(result.current.aivideoautoVideoModels).toEqual([]);
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

  describe('setAivideoautoAccessToken', () => {
    it('updates access token state', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setAivideoautoAccessToken('aivideoauto-token');
      });

      expect(result.current.aivideoautoAccessToken).toBe('aivideoauto-token');
    });

    it('can set token to null', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setAivideoautoAccessToken('token');
        result.current.setAivideoautoAccessToken(null);
      });

      expect(result.current.aivideoautoAccessToken).toBeNull();
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

  describe('setAivideoautoImageModels', () => {
    it('updates image models array', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      const models = [createMockAIVideoAutoModel('img-1'), createMockAIVideoAutoModel('img-2')];

      act(() => {
        result.current.setAivideoautoImageModels(models);
      });

      expect(result.current.aivideoautoImageModels).toEqual(models);
      expect(result.current.aivideoautoImageModels).toHaveLength(2);
    });
  });

  describe('setAivideoautoVideoModels', () => {
    it('updates video models array', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      const models = [createMockAIVideoAutoModel('vid-1')];

      act(() => {
        result.current.setAivideoautoVideoModels(models);
      });

      expect(result.current.aivideoautoVideoModels).toEqual(models);
      expect(result.current.aivideoautoVideoModels).toHaveLength(1);
    });
  });

  describe('model setters', () => {
    it('setImageEditModel updates imageEditModel', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('aivideoauto--custom-edit');
      });

      expect(result.current.imageEditModel).toBe('aivideoauto--custom-edit');
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

    it('setVideoGenerateModel updates videoGenerateModel', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setVideoGenerateModel('aivideoauto--video-model');
      });

      expect(result.current.videoGenerateModel).toBe('aivideoauto--video-model');
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
  });

  describe('getModelsForFeature', () => {
    describe('non-video features', () => {
      it('returns unchanged models for TryOn feature', () => {
        const { result } = renderHook(() => useApi(), {
          wrapper: createWrapper(),
        });

        const models = result.current.getModelsForFeature(Feature.TryOn);

        expect(models.imageEditModel).toBe('gemini-3-pro-image-preview');
        expect(models.imageGenerateModel).toBe('imagen-4.0-generate-001');
        expect(models.videoGenerateModel).toBe('');
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

        expect(models.videoGenerateModel).toBe('');
      });
    });

    describe('video features with AIVideoAuto override', () => {
      it('overrides non-aivideoauto model for Video feature', () => {
        const { result } = renderHook(() => useApi(), {
          wrapper: createWrapper(),
        });

        // Set a gemini video model (not aivideoauto)
        act(() => {
          result.current.setVideoGenerateModel('gemini-video');
          result.current.setAivideoautoVideoModels([createMockAIVideoAutoModel('veo-2')]);
        });

        const models = result.current.getModelsForFeature(Feature.Video);

        // Should override to aivideoauto model
        expect(models.videoGenerateModel).toBe('aivideoauto--veo-2');
      });

      it('overrides non-aivideoauto model for GRWMVideo feature', () => {
        const { result } = renderHook(() => useApi(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.setVideoGenerateModel('some-other-model');
          result.current.setAivideoautoVideoModels([createMockAIVideoAutoModel('grwm-model')]);
        });

        const models = result.current.getModelsForFeature(Feature.GRWMVideo);

        expect(models.videoGenerateModel).toBe('aivideoauto--grwm-model');
      });

      it('keeps aivideoauto model unchanged for video features', () => {
        const { result } = renderHook(() => useApi(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.setVideoGenerateModel('aivideoauto--existing-model');
          result.current.setAivideoautoVideoModels([createMockAIVideoAutoModel('other-model')]);
        });

        const models = result.current.getModelsForFeature(Feature.Video);

        // Should keep the existing aivideoauto model, not override
        expect(models.videoGenerateModel).toBe('aivideoauto--existing-model');
      });

      it('uses first available aivideoauto model when overriding', () => {
        const { result } = renderHook(() => useApi(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.setVideoGenerateModel('gemini-video');
          result.current.setAivideoautoVideoModels([
            createMockAIVideoAutoModel('first-model'),
            createMockAIVideoAutoModel('second-model'),
            createMockAIVideoAutoModel('third-model'),
          ]);
        });

        const models = result.current.getModelsForFeature(Feature.Video);

        // Should use the first available model
        expect(models.videoGenerateModel).toBe('aivideoauto--first-model');
      });
    });

    describe('video features with no AIVideoAuto models', () => {
      it('passes through non-aivideoauto model when no aivideoauto models available', () => {
        const { result } = renderHook(() => useApi(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.setVideoGenerateModel('gemini-video-model');
          // No aivideoauto models set (empty array by default)
        });

        const models = result.current.getModelsForFeature(Feature.Video);

        // Should pass through the invalid model
        // Service layer will handle the error
        expect(models.videoGenerateModel).toBe('gemini-video-model');
      });

      it('passes through empty string when no models available', () => {
        const { result } = renderHook(() => useApi(), {
          wrapper: createWrapper(),
        });

        // Default videoGenerateModel is ''
        const models = result.current.getModelsForFeature(Feature.Video);

        expect(models.videoGenerateModel).toBe('');
      });
    });

    describe('other models unchanged for video features', () => {
      it('does not affect imageEditModel for video features', () => {
        const { result } = renderHook(() => useApi(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.setImageEditModel('custom-image-edit');
        });

        const models = result.current.getModelsForFeature(Feature.Video);

        expect(models.imageEditModel).toBe('custom-image-edit');
      });

      it('does not affect textGenerateModel for video features', () => {
        const { result } = renderHook(() => useApi(), {
          wrapper: createWrapper(),
        });

        act(() => {
          result.current.setTextGenerateModel('custom-text-model');
        });

        const models = result.current.getModelsForFeature(Feature.GRWMVideo);

        expect(models.textGenerateModel).toBe('custom-text-model');
      });
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
        result.current.setVideoGenerateModel('video-1');
        result.current.setTextGenerateModel('text-1');
      });

      expect(result.current.imageEditModel).toBe('edit-1');
      expect(result.current.imageGenerateModel).toBe('gen-1');
      expect(result.current.videoGenerateModel).toBe('video-1');
      expect(result.current.textGenerateModel).toBe('text-1');
    });

    it('getModelsForFeature returns current state after updates', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('updated-edit');
        result.current.setAivideoautoVideoModels([createMockAIVideoAutoModel('new-video')]);
      });

      const nonVideoModels = result.current.getModelsForFeature(Feature.Lookbook);
      expect(nonVideoModels.imageEditModel).toBe('updated-edit');

      const videoModels = result.current.getModelsForFeature(Feature.Video);
      expect(videoModels.videoGenerateModel).toBe('aivideoauto--new-video');
    });
  });
});
