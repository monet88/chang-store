/**
 * Unit tests for services/apiClient.ts
 *
 * Tests the Gemini API client singleton management and API key handling.
 * Covers: setGeminiApiKey, getActiveApiKey, getGeminiClient, reinitializeGeminiClient
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Tracks all instances created by mocked GoogleGenAI */
const createdInstances: Array<{ config: { apiKey: string } }> = [];

/** Tracks constructor calls for verification */
const constructorCalls: Array<{ apiKey: string }> = [];

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
  function MockGoogleGenAI(this: {
    config: { apiKey: string };
    models: Record<string, unknown>;
    operations: Record<string, unknown>;
  }, config: { apiKey: string }) {
    this.config = config;
    this.models = {
      generateContent: vi.fn(),
      generateImages: vi.fn(),
      generateVideos: vi.fn(),
    };
    this.operations = {
      getVideosOperation: vi.fn(),
    };

    // Track for assertions
    createdInstances.push(this);
    constructorCalls.push(config);
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
  };
});

// Import after mocking
import {
  setGeminiApiKey,
  getActiveApiKey,
  getGeminiClient,
  reinitializeGeminiClient,
} from '@/services/apiClient';

describe('apiClient', () => {
  /** Store original env value to restore after tests */
  const originalApiKey = process.env.API_KEY;

  beforeEach(() => {
    // Reset module state before each test
    setGeminiApiKey(null);
    reinitializeGeminiClient();

    // Clear tracking arrays
    createdInstances.length = 0;
    constructorCalls.length = 0;

    // Clear environment variable by default
    delete process.env.API_KEY;
  });

  afterEach(() => {
    // Restore original environment variable
    if (originalApiKey !== undefined) {
      process.env.API_KEY = originalApiKey;
    } else {
      delete process.env.API_KEY;
    }
  });

  // ============================================================
  // setGeminiApiKey tests
  // ============================================================
  describe('setGeminiApiKey', () => {
    it('should set a custom API key', () => {
      // Arrange
      const customKey = 'custom-api-key-123';

      // Act
      setGeminiApiKey(customKey);

      // Assert - verify by getting active key
      expect(getActiveApiKey()).toBe(customKey);
    });

    it('should clear the client instance when setting a new key', () => {
      // Arrange - create initial client
      setGeminiApiKey('initial-key');
      const firstClient = getGeminiClient();

      // Act - set a new key
      setGeminiApiKey('new-key');
      const secondClient = getGeminiClient();

      // Assert - constructor should be called twice (new instance created)
      expect(constructorCalls).toHaveLength(2);
      expect(firstClient).not.toBe(secondClient);
    });

    it('should allow clearing the custom key by passing null', () => {
      // Arrange
      setGeminiApiKey('some-key');
      process.env.API_KEY = 'env-key';

      // Act
      setGeminiApiKey(null);

      // Assert - should fall back to env key
      expect(getActiveApiKey()).toBe('env-key');
    });
  });

  // ============================================================
  // getActiveApiKey tests
  // ============================================================
  describe('getActiveApiKey', () => {
    it('should return custom API key when set', () => {
      // Arrange
      const customKey = 'my-custom-key';
      setGeminiApiKey(customKey);
      process.env.API_KEY = 'env-key-should-not-use';

      // Act
      const result = getActiveApiKey();

      // Assert - custom key takes precedence
      expect(result).toBe(customKey);
    });

    it('should return environment variable when no custom key is set', () => {
      // Arrange
      process.env.API_KEY = 'env-api-key-456';

      // Act
      const result = getActiveApiKey();

      // Assert
      expect(result).toBe('env-api-key-456');
    });

    it('should throw error when no API key is configured', () => {
      // Arrange - ensure no keys are set
      setGeminiApiKey(null);
      delete process.env.API_KEY;

      // Act & Assert
      expect(() => getActiveApiKey()).toThrow(
        'API_KEY is not configured. Please set it in the settings or environment.'
      );
    });

    it('should prioritize custom key over environment variable', () => {
      // Arrange
      setGeminiApiKey('priority-custom-key');
      process.env.API_KEY = 'should-be-ignored';

      // Act
      const result = getActiveApiKey();

      // Assert
      expect(result).toBe('priority-custom-key');
    });
  });

  // ============================================================
  // getGeminiClient tests
  // ============================================================
  describe('getGeminiClient', () => {
    it('should create a new GoogleGenAI instance with the active API key', () => {
      // Arrange
      setGeminiApiKey('test-api-key');

      // Act
      getGeminiClient();

      // Assert
      expect(constructorCalls).toHaveLength(1);
      expect(constructorCalls[0]).toEqual({ apiKey: 'test-api-key' });
    });

    it('should return the same instance on subsequent calls (singleton pattern)', () => {
      // Arrange
      setGeminiApiKey('singleton-test-key');

      // Act
      const firstCall = getGeminiClient();
      const secondCall = getGeminiClient();
      const thirdCall = getGeminiClient();

      // Assert - only one instance created
      expect(constructorCalls).toHaveLength(1);
      expect(firstCall).toBe(secondCall);
      expect(secondCall).toBe(thirdCall);
    });

    it('should create new instance after reinitializeGeminiClient is called', () => {
      // Arrange
      setGeminiApiKey('reuse-key');
      const firstClient = getGeminiClient();

      // Act
      reinitializeGeminiClient();
      const secondClient = getGeminiClient();

      // Assert - new instance created
      expect(constructorCalls).toHaveLength(2);
      expect(firstClient).not.toBe(secondClient);
    });

    it('should throw error if no API key is available', () => {
      // Arrange - no keys configured
      setGeminiApiKey(null);
      delete process.env.API_KEY;

      // Act & Assert
      expect(() => getGeminiClient()).toThrow(
        'API_KEY is not configured. Please set it in the settings or environment.'
      );
    });

    it('should use env key when no custom key is set', () => {
      // Arrange
      process.env.API_KEY = 'env-key-for-client';

      // Act
      getGeminiClient();

      // Assert
      expect(constructorCalls[0]).toEqual({ apiKey: 'env-key-for-client' });
    });
  });

  // ============================================================
  // reinitializeGeminiClient tests
  // ============================================================
  describe('reinitializeGeminiClient', () => {
    it('should clear the cached client instance', () => {
      // Arrange
      setGeminiApiKey('cached-key');
      getGeminiClient(); // Create instance

      // Act
      reinitializeGeminiClient();
      getGeminiClient(); // Should create new instance

      // Assert
      expect(constructorCalls).toHaveLength(2);
    });

    it('should not throw when called with no existing instance', () => {
      // Act & Assert - should not throw
      expect(() => reinitializeGeminiClient()).not.toThrow();
    });

    it('should allow key change to take effect after reinitialization', () => {
      // Arrange
      setGeminiApiKey('first-key');
      getGeminiClient();

      // Act - change key via env and reinitialize
      reinitializeGeminiClient();
      setGeminiApiKey('second-key');
      getGeminiClient();

      // Assert - second call should use new key
      expect(constructorCalls[constructorCalls.length - 1]).toEqual({ apiKey: 'second-key' });
    });
  });

  // ============================================================
  // Integration scenarios
  // ============================================================
  describe('integration scenarios', () => {
    it('should handle complete key rotation workflow', () => {
      // Step 1: Start with env key
      process.env.API_KEY = 'initial-env-key';
      const client1 = getGeminiClient();
      expect(constructorCalls[0]).toEqual({ apiKey: 'initial-env-key' });

      // Step 2: User sets custom key (clears instance automatically)
      setGeminiApiKey('user-custom-key');
      const client2 = getGeminiClient();
      expect(constructorCalls[1]).toEqual({ apiKey: 'user-custom-key' });
      expect(client1).not.toBe(client2);

      // Step 3: User clears custom key, falls back to env
      setGeminiApiKey(null);
      const client3 = getGeminiClient();
      expect(constructorCalls[2]).toEqual({ apiKey: 'initial-env-key' });

      // Verify total instances created
      expect(constructorCalls).toHaveLength(3);
    });

    it('should maintain singleton between getGeminiClient calls without key changes', () => {
      // Arrange
      setGeminiApiKey('stable-key');

      // Act - multiple calls
      const clients = [
        getGeminiClient(),
        getGeminiClient(),
        getGeminiClient(),
        getGeminiClient(),
      ];

      // Assert - all same instance
      expect(constructorCalls).toHaveLength(1);
      expect(new Set(clients).size).toBe(1); // All references are the same
    });
  });
});
