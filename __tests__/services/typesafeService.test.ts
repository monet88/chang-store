import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  callSystemOne,
  classifyVirtualTryOnItemTypes,
  resolveTypesafeApiKey,
  resolveTypesafeBaseUrl,
  DEFAULT_TYPESAFE_BASE_URL,
  TYPESAFE_STORAGE_KEY_API_KEY,
  TYPESAFE_STORAGE_KEY_BASE_URL,
} from '@/services/typesafeService';

describe('typesafeService', () => {
  const originalEnvKey = process.env.TYPESAFE_API_KEY;
  const originalEnvUrl = process.env.TYPESAFE_BASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_BASE_URL;
  });

  afterEach(() => {
    process.env.TYPESAFE_API_KEY = originalEnvKey;
    process.env.TYPESAFE_BASE_URL = originalEnvUrl;
  });

  describe('resolveTypesafeApiKey', () => {
    it('returns null when no key is configured', () => {
      expect(resolveTypesafeApiKey()).toBeNull();
    });

    it('reads from process.env when localStorage is empty', () => {
      process.env.TYPESAFE_API_KEY = 'env-secret-key';
      expect(resolveTypesafeApiKey()).toBe('env-secret-key');
    });

    it('prefers localStorage over process.env', () => {
      process.env.TYPESAFE_API_KEY = 'env-secret-key';
      localStorage.setItem(TYPESAFE_STORAGE_KEY_API_KEY, 'custom-ui-key');
      expect(resolveTypesafeApiKey()).toBe('custom-ui-key');
    });
  });

  describe('resolveTypesafeBaseUrl', () => {
    it('defaults to official TypeSafe v1 endpoint', () => {
      expect(resolveTypesafeBaseUrl()).toBe(DEFAULT_TYPESAFE_BASE_URL);
    });

    it('reads from process.env and trims trailing slashes', () => {
      process.env.TYPESAFE_BASE_URL = 'https://custom.gateway.io/v1///';
      expect(resolveTypesafeBaseUrl()).toBe('https://custom.gateway.io/v1');
    });

    it('prefers localStorage over process.env', () => {
      process.env.TYPESAFE_BASE_URL = 'https://custom.gateway.io/v1';
      localStorage.setItem(TYPESAFE_STORAGE_KEY_BASE_URL, 'https://ui.gateway.io/v1/');
      expect(resolveTypesafeBaseUrl()).toBe('https://ui.gateway.io/v1');
    });
  });

  describe('callSystemOne', () => {
    it('throws when API key is missing', async () => {
      await expect(
        callSystemOne({
          state: 'test',
          questions: {
            q1: { type: 'noul', instructions: 'Is test?' },
          },
        }),
      ).rejects.toThrow('error.typesafe.missingApiKey');
    });

    it('sends POST request with bearer token and returns response', async () => {
      process.env.TYPESAFE_API_KEY = 'test-key';
      const mockResponse = {
        model: 'jev-1.13.0',
        answers: {
          urgency: { type: 'noul', noul: 0.95 },
        },
        usage: { input_tokens: 100, output_tokens: 20 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const res = await callSystemOne({
        state: 'Help fast',
        questions: {
          urgency: { type: 'noul', instructions: 'Urgent?' },
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.typesafe.ai/v1/systemone',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'jev-latest',
            state: 'Help fast',
            questions: {
              urgency: { type: 'noul', instructions: 'Urgent?' },
            },
          }),
        }),
      );
      expect(res).toEqual(mockResponse);
    });

    it('throws with status and detail when API returns error', async () => {
      process.env.TYPESAFE_API_KEY = 'test-key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: { message: 'Bad key' } }),
      } as Response);

      await expect(
        callSystemOne({
          state: 'test',
          questions: { q: { type: 'noul', instructions: '?' } },
        }),
      ).rejects.toThrow('error.typesafe.requestFailed:401:Bad key');
    });
  });

  describe('classifyVirtualTryOnItemTypes', () => {
    it('returns empty record when input is empty or blank', async () => {
      const res = await classifyVirtualTryOnItemTypes([{ id: 1, text: '   ' }]);
      expect(res).toEqual({});
    });

    it('fans out Choice questions and returns classified map', async () => {
      process.env.TYPESAFE_API_KEY = 'test-key';
      const mockResponse = {
        model: 'jev-1.13.0',
        answers: {
          item_101: {
            type: 'choice',
            choice: 'clothing',
            confidence: 0.98,
            probabilities: { clothing: 0.98, shoes: 0.01, bag: 0.01, accessory: 0 },
          },
          item_102: {
            type: 'choice',
            choice: 'shoes',
            confidence: 0.95,
            probabilities: { shoes: 0.95, clothing: 0.05, bag: 0, accessory: 0 },
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const res = await classifyVirtualTryOnItemTypes([
        { id: 101, text: 'Silk blouse' },
        { id: 102, text: 'Leather heels' },
      ]);

      expect(res).toEqual({
        '101': { type: 'clothing', confidence: 0.98 },
        '102': { type: 'shoes', confidence: 0.95 },
      });
    });
  });
});
