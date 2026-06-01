import { describe, it, expect } from 'vitest';
import { parseOpenAIResponse } from '@/services/providers/shared/openaiCompatibleResponse';
import { ProviderApiError, ProviderUnsupportedResponseError } from '@/services/providers/shared/ProviderApiError';

describe('parseOpenAIResponse', () => {
  it('extracts b64_json images with the given mime type', () => {
    const result = parseOpenAIResponse(
      { data: [{ b64_json: 'AAAA' }, { b64_json: 'BBBB' }] },
      'image/jpeg',
    );

    expect(result).toEqual([
      { base64: 'AAAA', mimeType: 'image/jpeg' },
      { base64: 'BBBB', mimeType: 'image/jpeg' },
    ]);
  });

  it('defaults to image/png when no mime type is supplied', () => {
    const result = parseOpenAIResponse({ data: [{ b64_json: 'AAAA' }] });
    expect(result[0].mimeType).toBe('image/png');
  });

  it('throws ProviderApiError when an error envelope is present (200 + error body)', () => {
    expect(() =>
      parseOpenAIResponse({ error: { message: 'bad', code: 'invalid_request' } }),
    ).toThrow(ProviderApiError);
  });

  it('checks the error envelope before attempting data extraction', () => {
    try {
      parseOpenAIResponse({ error: { message: 'nope', type: 'server_error' }, data: [{ b64_json: 'AAAA' }] });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderApiError);
      expect((err as ProviderApiError).code).toBe('server_error');
    }
  });

  it('throws ProviderUnsupportedResponseError for URL-only responses', () => {
    expect(() =>
      parseOpenAIResponse({ data: [{ url: 'https://example.com/image.png' }] }),
    ).toThrow(ProviderUnsupportedResponseError);
  });

  it('throws ProviderUnsupportedResponseError when data is empty', () => {
    expect(() => parseOpenAIResponse({ data: [] })).toThrow(ProviderUnsupportedResponseError);
  });

  it('throws ProviderUnsupportedResponseError for malformed responses', () => {
    expect(() => parseOpenAIResponse(null)).toThrow(ProviderUnsupportedResponseError);
    expect(() => parseOpenAIResponse('nope')).toThrow(ProviderUnsupportedResponseError);
  });
});
