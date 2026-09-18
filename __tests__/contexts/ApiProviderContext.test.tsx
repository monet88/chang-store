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
const mockConfigureGeminiClient = vi.fn();
const mockShowToast = vi.fn();

vi.mock('@/services/apiClient', () => ({
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
      expect(typeof result.current.setCpaGatewaySettings).toBe('function');
    });
  });

  describe('default values', () => {
    it('has correct default model values', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.imageEditModel).toBe('gemini-3.1-flash-image');
      expect(result.current.imageGenerateModel).toBe('gemini-3.1-flash-image');
      expect(result.current.textGenerateModel).toBe('gemini-3.8-flash');
    });

    it('defaults to the CPA gateway URL with no key when the environment provides none', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.cpaGatewaySettings.url).toBe('https://cliproxy.monet.uno');
      expect(result.current.cpaGatewaySettings.apiKey).toBe('');
    });

    it('uses the gateway API key from the environment when nothing is stored', () => {
      vi.stubEnv('CLIPROXY_API_KEY', 'env-gateway-key');

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.cpaGatewaySettings.apiKey).toBe('env-gateway-key');
      vi.unstubAllEnvs();
    });

    it('migrates a legacy vertex_proxy key into the cpa_gateway key', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'vertex_proxy_url') return 'https://legacy.example.com';
        if (key === 'vertex_proxy_api_key') return 'legacy-key';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.cpaGatewaySettings.url).toBe('https://legacy.example.com');
      expect(result.current.cpaGatewaySettings.apiKey).toBe('legacy-key');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cpa_gateway_url', 'https://legacy.example.com');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cpa_gateway_api_key', 'legacy-key');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('vertex_proxy_url');
    });

    it('honors a stored text model that the gateway serves', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'text_generate_model') return 'gemini-3.7-flash';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.textGenerateModel).toBe('gemini-3.7-flash');
    });

    it('falls back to default models when stored ids are not served by the gateway', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'image_edit_model') return 'gemini-3-pro-image';
        if (key === 'image_generate_model') return 'gemini-2.5-flash-image';
        if (key === 'text_generate_model') return 'gemini-3.5-flash';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.imageEditModel).toBe('gemini-3.1-flash-image');
      expect(result.current.imageGenerateModel).toBe('gemini-3.1-flash-image');
      expect(result.current.textGenerateModel).toBe('gemini-3.8-flash');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_edit_model', 'gemini-3.1-flash-image');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('image_generate_model', 'gemini-3.1-flash-image');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('text_generate_model', 'gemini-3.8-flash');
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
        firstMount.result.current.setImageEditModel('gemini-3.1-flash-image');
        firstMount.result.current.setImageGenerateModel('gemini-3.1-flash-image');
        firstMount.result.current.setTextGenerateModel('gemini-3.7-flash');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('text_generate_model', 'gemini-3.7-flash');

      firstMount.unmount();
      localStorageMock.getItem.mockClear();
      localStorageMock.setItem.mockClear();
      localStorageMock.removeItem.mockClear();

      const secondMount = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('text_generate_model');
      expect(secondMount.result.current.imageEditModel).toBe('gemini-3.1-flash-image');
      expect(secondMount.result.current.imageGenerateModel).toBe('gemini-3.1-flash-image');
      expect(secondMount.result.current.textGenerateModel).toBe('gemini-3.7-flash');
    });

    it('rehydrates persisted gateway settings after remounting the provider', () => {
      const firstMount = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        firstMount.result.current.setCpaGatewaySettings({
          url: 'https://gateway.example.com',
          apiKey: 'persisted-gateway-key',
        });
      });

      firstMount.unmount();
      localStorageMock.getItem.mockClear();

      const secondMount = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('cpa_gateway_api_key');
      expect(secondMount.result.current.cpaGatewaySettings.url).toBe('https://gateway.example.com');
      expect(secondMount.result.current.cpaGatewaySettings.apiKey).toBe('persisted-gateway-key');
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
      expect(result.current.textGenerateModel).toBe('gemini-3.8-flash');
      expect(result.current.cpaGatewaySettings.url).toBe('https://cliproxy.monet.uno');
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

  describe('stored gateway URL', () => {
    it('keeps a stored cliproxy.monet.uno URL instead of rewriting it', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'cpa_gateway_url') return 'https://cliproxy.monet.uno';
        if (key === 'cpa_gateway_api_key') return 'legacy-key';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.cpaGatewaySettings.url).toBe('https://cliproxy.monet.uno');
      expect(result.current.cpaGatewaySettings.apiKey).toBe('legacy-key');
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith('cpa_gateway_url', 'https://vertex.monet.uno/gemini');
    });

    it('keeps a stored cliproxy URL that carries a path suffix', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'cpa_gateway_url') return 'https://cliproxy.monet.uno/v1';
        return null;
      });

      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.cpaGatewaySettings.url).toBe('https://cliproxy.monet.uno/v1');
    });
  });

  describe('CPA gateway restore handling', () => {
    it('resets an invalid stored URL to the default and toasts only once across rerenders', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'cpa_gateway_url') return 'not-a-valid-url';
        if (key === 'cpa_gateway_api_key') return '';
        return null;
      });

      const { result, rerender } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.cpaGatewaySettings.url).toBe('https://cliproxy.monet.uno');
      expect(mockShowToast).toHaveBeenCalledTimes(1);

      rerender();

      expect(mockShowToast).toHaveBeenCalledTimes(1);
    });

    it('does not re-toast after an invalid stored URL has been reset', () => {
      localStorageMock.setItem('cpa_gateway_url', 'not-a-valid-url');
      localStorageMock.setItem('cpa_gateway_api_key', 'persisted-gateway-key');

      const firstMount = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(firstMount.result.current.cpaGatewaySettings.url).toBe('https://cliproxy.monet.uno');
      firstMount.unmount();

      localStorageMock.getItem.mockClear();
      mockShowToast.mockClear();

      const secondMount = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(secondMount.result.current.cpaGatewaySettings.url).toBe('https://cliproxy.monet.uno');
      expect(secondMount.result.current.cpaGatewaySettings.apiKey).toBe('persisted-gateway-key');
      expect(mockShowToast).not.toHaveBeenCalled();
    });
  });

  describe('provider settings', () => {
    it('exposes gptImage default settings with built-in base URLs', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      expect(result.current.providerSettings.gptImage.baseUrl).toBe('https://api.openai.com/v1');
      // No env injection in test env → empty key defaults.
      expect(result.current.providerSettings.gptImage.apiKey).toBe('');
    });

    it('persists provider overrides to namespaced localStorage keys', () => {
      const { result } = renderHook(() => useApi(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setProviderSettings('gptImage', { apiKey: 'xai-key', baseUrl: 'https://api.openai.com/v1' });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('provider:gptImage:apiKey', 'xai-key');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('provider:gptImage:baseUrl', 'https://api.openai.com/v1');
      expect(result.current.providerSettings.gptImage.apiKey).toBe('xai-key');
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
        result.current.setProviderSettings('gptImage', { apiKey: 'temp-key', baseUrl: 'https://custom.example.com/v1' });
      });
      expect(result.current.providerSettings.gptImage.apiKey).toBe('temp-key');

      act(() => {
        result.current.resetProviderSettings('gptImage');
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('provider:gptImage:apiKey');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('provider:gptImage:baseUrl');
      expect(result.current.providerSettings.gptImage.apiKey).toBe('');
      expect(result.current.providerSettings.gptImage.baseUrl).toBe('https://api.openai.com/v1');
    });
  });
});
