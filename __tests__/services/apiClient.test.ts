/**
 * Unit tests for services/apiClient.ts
 *
 * Tests the Gemini client singleton and credential resolution:
 * gateway mode (base URL configured) is the only accepted route; the direct
 * Gemini path survives only when no base URL is configured.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Tracks constructor calls for verification */
const constructorCalls: Array<Record<string, unknown>> = [];

/**
 * Mock the @google/genai module before importing apiClient
 *
 * vi.mock is hoisted, so the factory must be self-contained.
 * We use a function constructor pattern for proper `new` behavior.
 */
vi.mock('@google/genai', () => {
  /**
   * Mock constructor for GoogleGenAI SDK
   * Uses function pattern to work with `new` keyword.
   */
  function MockGoogleGenAI(this: { config: Record<string, unknown> }, config: Record<string, unknown>) {
    this.config = config;
    constructorCalls.push(config);
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
  };
});

// Import after mocking
import {
  configureGeminiClient,
  getActiveApiKey,
  getGeminiClient,
  isProxyEnabled,
  reinitializeGeminiClient,
} from '@/services/apiClient';

const GATEWAY_URL = 'https://cliproxy.monet.uno';

describe('apiClient', () => {
  beforeEach(() => {
    configureGeminiClient({ apiKey: null, baseUrl: null });
    reinitializeGeminiClient();
    constructorCalls.length = 0;
  });

  // ============================================================
  // isProxyEnabled tests
  // ============================================================
  describe('isProxyEnabled', () => {
    it('should report a configured base URL as proxy mode', () => {
      // Arrange & Act
      configureGeminiClient({ apiKey: 'gateway-key', baseUrl: GATEWAY_URL });

      // Assert
      expect(isProxyEnabled()).toBe(true);
    });

    it('should report direct mode when no base URL is configured', () => {
      // Act & Assert
      expect(isProxyEnabled()).toBe(false);
    });
  });

  // ============================================================
  // getActiveApiKey tests
  // ============================================================
  describe('getActiveApiKey', () => {
    it('should return the gateway key when the gateway is configured', () => {
      // Arrange
      configureGeminiClient({ apiKey: 'gateway-key', baseUrl: GATEWAY_URL });

      // Act & Assert
      expect(getActiveApiKey()).toBe('gateway-key');
    });

    it('should throw when the gateway is configured without a key', () => {
      // Arrange — a key that trims away is no key at all
      configureGeminiClient({ apiKey: '   ', baseUrl: GATEWAY_URL });

      // Act & Assert
      expect(() => getActiveApiKey()).toThrow(
        'API_KEY is not configured. Please set it in the settings or environment.'
      );
    });

    it('should use the configured key in direct mode', () => {
      // Arrange
      configureGeminiClient({ apiKey: 'direct-key', baseUrl: null });

      // Act & Assert
      expect(getActiveApiKey()).toBe('direct-key');
    });

    it('should throw when no key is configured at all', () => {
      // Act & Assert
      expect(() => getActiveApiKey()).toThrow(
        'API_KEY is not configured. Please set it in the settings or environment.'
      );
    });

    it('should throw when nothing is configured', () => {
      // Act & Assert
      expect(() => getActiveApiKey()).toThrow(
        'API_KEY is not configured. Please set it in the settings or environment.'
      );
    });
  });

  // ============================================================
  // getGeminiClient tests
  // ============================================================
  describe('getGeminiClient', () => {
    it('should send the gateway key and base URL to the SDK', () => {
      // Arrange
      configureGeminiClient({ apiKey: 'gateway-key', baseUrl: GATEWAY_URL });

      // Act
      getGeminiClient();

      // Assert
      expect(constructorCalls).toHaveLength(1);
      expect(constructorCalls[0]).toMatchObject({
        apiKey: 'gateway-key',
        apiVersion: 'v1beta',
        httpOptions: { baseUrl: GATEWAY_URL },
      });
    });

    it('should return the same instance on subsequent calls (singleton pattern)', () => {
      // Arrange
      configureGeminiClient({ apiKey: 'gateway-key', baseUrl: GATEWAY_URL });

      // Act
      const firstCall = getGeminiClient();
      const secondCall = getGeminiClient();

      // Assert
      expect(constructorCalls).toHaveLength(1);
      expect(firstCall).toBe(secondCall);
    });

    it('should throw when the gateway has no key', () => {
      // Arrange
      configureGeminiClient({ apiKey: null, baseUrl: GATEWAY_URL });

      // Act & Assert
      expect(() => getGeminiClient()).toThrow(
        'API_KEY is not configured. Please set it in the settings or environment.'
      );
    });

    it('should rebuild the client when the gateway credentials change', () => {
      // Arrange
      configureGeminiClient({ apiKey: 'first-key', baseUrl: GATEWAY_URL });
      const firstClient = getGeminiClient();

      // Act
      configureGeminiClient({ apiKey: 'second-key', baseUrl: GATEWAY_URL });
      const secondClient = getGeminiClient();

      // Assert
      expect(constructorCalls).toHaveLength(2);
      expect(firstClient).not.toBe(secondClient);
      expect(constructorCalls[1]).toMatchObject({ apiKey: 'second-key' });
    });
  });

  // ============================================================
  // reinitializeGeminiClient tests
  // ============================================================
  describe('reinitializeGeminiClient', () => {
    it('should clear the cached client instance', () => {
      // Arrange
      configureGeminiClient({ apiKey: 'gateway-key', baseUrl: GATEWAY_URL });
      getGeminiClient();

      // Act
      reinitializeGeminiClient();
      getGeminiClient();

      // Assert
      expect(constructorCalls).toHaveLength(2);
    });

    it('should not throw when called with no existing instance', () => {
      // Act & Assert
      expect(() => reinitializeGeminiClient()).not.toThrow();
    });
  });
});
