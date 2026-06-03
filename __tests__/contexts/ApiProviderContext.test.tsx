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
import { ReactNode } from 'react';
import { ApiProvider, useApi } from '@/contexts/ApiProviderContext';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

/** Mock apiClient wiring */
const mockSetGeminiApiKey = vi.fn();
const mockConfigureGeminiClient = vi.fn();
const mockShowToast = vi.fn();

vi.mock('@/services/apiClient', () => ({
  setGeminiApiKey: (key: string | null) => mockSetGeminiApiKey(key),
  configureGeminiClient: (config: unknown) => mockConfigureGeminiClient(config),
}));

vi.mock('@/components/Toast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

/** localStorage mock implementation */
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  const mock = {
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
    resetMocks: () => {
      mock.getItem.mockImplementation((key: string) => store[key] ?? null);
      mock.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
      });
      mock.removeItem.mockImplementation((key: string) => {
        delete store[key];
      });
      mock.clear.mockImplementation(() => {
        store = {};
      });
    },
  };

  return mock;
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });

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
    localStorageMock.resetMocks();
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

      expect(result.current.imageEditModel).toBe('gemini-3.1-flash-image');
      expect(result.current.imageGenerateModel).toBe('gemini-3.1-flash-image');
      expect(result.current.textGenerateModel).toBe('gemini-3.5-flash');
    });

    it('has null Google API key by default', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.googleApiKey).toBeNull();
    });

    it('loads Google API key from localStorage on mount when present', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'google_api_key') return 'stored-api-key';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('google_api_key');
      expect(result.current.googleApiKey).toBe('stored-api-key');
    });

    it('loads model selections from localStorage on mount when valid', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'image_edit_model') return 'gemini-2.5-flash-image';
        if (key === 'image_generate_model') return 'gemini-3-pro-image';
        if (key === 'text_generate_model') return 'gemini-3.5-flash';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('image_edit_model');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('image_generate_model');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('text_generate_model');
      expect(result.current.imageEditModel).toBe('gemini-2.5-flash-image');
      expect(result.current.imageGenerateModel).toBe('gemini-3-pro-image');
      expect(result.current.textGenerateModel).toBe('gemini-3.5-flash');
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

      expect(result.current.imageEditModel).toBe('gemini-3.1-flash-image');
      expect(result.current.imageGenerateModel).toBe('gemini-3.1-flash-image');
      expect(result.current.textGenerateModel).toBe('gemini-3.5-flash');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_edit_model', 'gemini-3.1-flash-image');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_generate_model', 'gemini-3.1-flash-image');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('text_generate_model', 'gemini-3.5-flash');
    });
  });

  describe('setGoogleApiKey', () => {
    it('persists Google API key to localStorage when setting a value', () => {
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

    it('clears in-memory key when setting null', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setGoogleApiKey('temp-key');
      });

      act(() => {
        result.current.setGoogleApiKey(null);
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('google_api_key');
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
        result.current.setImageGenerateModel('gemini-3-pro-image');
      });

      expect(result.current.imageGenerateModel).toBe('gemini-3-pro-image');
    });

    it('setTextGenerateModel updates textGenerateModel', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setTextGenerateModel('gemini-3.5-flash');
      });

      expect(result.current.textGenerateModel).toBe('gemini-3.5-flash');
    });

    it('persists model selections to localStorage', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setImageEditModel('gemini-2.5-flash-image');
        result.current.setImageGenerateModel('gemini-3-pro-image');
        result.current.setTextGenerateModel('gemini-3.5-flash');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_edit_model', 'gemini-2.5-flash-image');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_generate_model', 'gemini-3-pro-image');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('text_generate_model', 'gemini-3.5-flash');
    });

    it('rehydrates persisted model selections after remounting the provider', () => {
      const firstMount = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        firstMount.result.current.setImageEditModel('gemini-2.5-flash-image');
        firstMount.result.current.setImageGenerateModel('gemini-3-pro-image');
        firstMount.result.current.setTextGenerateModel('gemini-3.5-flash');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_edit_model', 'gemini-2.5-flash-image');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_generate_model', 'gemini-3-pro-image');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('text_generate_model', 'gemini-3.5-flash');

      firstMount.unmount();
      localStorageMock.getItem.mockClear();
      localStorageMock.setItem.mockClear();
      localStorageMock.removeItem.mockClear();

      const secondMount = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('image_edit_model');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('image_generate_model');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('text_generate_model');
      expect(secondMount.result.current.imageEditModel).toBe('gemini-2.5-flash-image');
      expect(secondMount.result.current.imageGenerateModel).toBe('gemini-3-pro-image');
      expect(secondMount.result.current.textGenerateModel).toBe('gemini-3.5-flash');
    });

    it('rehydrates persisted Google API key after remounting the provider', () => {
      const firstMount = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        firstMount.result.current.setGoogleApiKey('persisted-google-key');
      });

      firstMount.unmount();
      localStorageMock.getItem.mockClear();

      const secondMount = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(secondMount.result.current.googleApiKey).toBe('persisted-google-key');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('google_api_key');
    });

    it('falls back safely when localStorage reads or cleanup throw', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('read failed');
      });
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('remove failed');
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.imageEditModel).toBe('gemini-3.1-flash-image');
      expect(result.current.imageGenerateModel).toBe('gemini-3.1-flash-image');
      expect(result.current.textGenerateModel).toBe('gemini-3.5-flash');
      expect(result.current.googleApiKey).toBeNull();
    });

    it('keeps in-memory model updates even when localStorage writes fail', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('write failed');
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(() => {
        act(() => {
          result.current.setImageEditModel('gemini-2.5-flash-image');
          result.current.setImageGenerateModel('gemini-3-pro-image');
          result.current.setTextGenerateModel('gemini-3.5-flash');
        });
      }).not.toThrow();

      expect(result.current.imageEditModel).toBe('gemini-2.5-flash-image');
      expect(result.current.imageGenerateModel).toBe('gemini-3-pro-image');
      expect(result.current.textGenerateModel).toBe('gemini-3.5-flash');
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
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

  describe('vertex proxy restore handling', () => {
    it('shows the invalid restore toast only once across rerenders', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'vertex_proxy_enabled') return 'true';
        if (key === 'vertex_proxy_url') return 'not-a-valid-url';
        if (key === 'vertex_proxy_api_key') return '';
        return null;
      });

      const { result, rerender } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.vertexProxySettings.enabled).toBe(false);
      expect(result.current.vertexProxySettings.url).toBe('https://cliproxy.monet.uno');
      expect(mockShowToast).toHaveBeenCalledTimes(1);

      rerender();

      expect(mockShowToast).toHaveBeenCalledTimes(1);
    });
  });

  describe('provider settings', () => {
    it('exposes grok and gptImage default settings with built-in base URLs', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.providerSettings.grok.baseUrl).toBe('https://api.x.ai/v1');
      expect(result.current.providerSettings.gptImage.baseUrl).toBe('https://api.openai.com/v1');
      // No env injection in test env → empty key defaults.
      expect(result.current.providerSettings.grok.apiKey).toBe('');
      expect(result.current.providerSettings.gptImage.apiKey).toBe('');
    });

    it('persists provider overrides to namespaced localStorage keys', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setProviderSettings('grok', { apiKey: 'xai-key', baseUrl: 'https://api.x.ai/v1' });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('provider:grok:apiKey', 'xai-key');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('provider:grok:baseUrl', 'https://api.x.ai/v1');
      expect(result.current.providerSettings.grok.apiKey).toBe('xai-key');
    });

    it('rehydrates persisted provider settings after remount', () => {
      const first = renderHook(() => useApi(), { wrapper: createWrapper() });

      act(() => {
        first.result.current.setProviderSettings('gptImage', { apiKey: 'oai-key' });
      });

      first.unmount();

      const second = renderHook(() => useApi(), { wrapper: createWrapper() });
      expect(second.result.current.providerSettings.gptImage.apiKey).toBe('oai-key');
    });

    it('resetProviderSettings clears overrides and falls back to defaults', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setProviderSettings('grok', { apiKey: 'temp-key', baseUrl: 'https://custom.example.com/v1' });
      });
      expect(result.current.providerSettings.grok.apiKey).toBe('temp-key');

      act(() => {
        result.current.resetProviderSettings('grok');
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('provider:grok:apiKey');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('provider:grok:baseUrl');
      expect(result.current.providerSettings.grok.apiKey).toBe('');
      expect(result.current.providerSettings.grok.baseUrl).toBe('https://api.x.ai/v1');
    });
  });
});
