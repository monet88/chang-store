/**
 * Google Drive Service Unit Tests
 *
 * Tests for googleDriveService functions with mocked fetch.
 * Covers getOrCreateAppFolder for both existing and new folder scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOrCreateAppFolder } from '@/services/googleDriveService';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MOCK_ACCESS_TOKEN = 'mock-access-token-12345';
const MOCK_FOLDER_ID = 'folder-id-abc123';
const MOCK_NEW_FOLDER_ID = 'new-folder-id-xyz789';

// -----------------------------------------------------------------------------
// Test Utilities
// -----------------------------------------------------------------------------

/**
 * Creates a mock fetch response
 * @param data - Response data
 * @param ok - Whether response is successful
 * @param status - HTTP status code
 */
function createMockResponse(
  data: unknown,
  ok = true,
  status = 200
): Response {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  } as Response;
}

// -----------------------------------------------------------------------------
// Test Suites
// -----------------------------------------------------------------------------

describe('googleDriveService', () => {
  // Store original fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('getOrCreateAppFolder', () => {
    it('returns existing folder ID when folder exists', async () => {
      // Mock fetch to return existing folder
      global.fetch = vi.fn().mockResolvedValueOnce(
        createMockResponse({
          files: [{ id: MOCK_FOLDER_ID, name: 'Chang-Store-Gallery' }],
        })
      );

      const result = await getOrCreateAppFolder(MOCK_ACCESS_TOKEN);

      expect(result).toBe(MOCK_FOLDER_ID);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Verify search query was made
      const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callUrl).toContain('drive/v3/files');
      expect(callUrl).toContain('Chang-Store-Gallery');
    });

    it('creates new folder when folder does not exist', async () => {
      // First call: search returns empty
      // Second call: create returns new folder ID
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          createMockResponse({ files: [] })
        )
        .mockResolvedValueOnce(
          createMockResponse({ id: MOCK_NEW_FOLDER_ID })
        );

      const result = await getOrCreateAppFolder(MOCK_ACCESS_TOKEN);

      expect(result).toBe(MOCK_NEW_FOLDER_ID);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify create request was POST with correct body
      const createCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(createCall[1].method).toBe('POST');
      expect(createCall[1].body).toContain('Chang-Store-Gallery');
    });

    it('uses correct authorization header', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        createMockResponse({
          files: [{ id: MOCK_FOLDER_ID, name: 'Chang-Store-Gallery' }],
        })
      );

      await getOrCreateAppFolder(MOCK_ACCESS_TOKEN);

      const callOptions = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callOptions.headers.Authorization).toBe(`Bearer ${MOCK_ACCESS_TOKEN}`);
    });

    it('throws error when API returns error status', async () => {
      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValueOnce(
        createMockResponse(
          { error: { message: 'Unauthorized' } },
          false,
          401
        )
      );

      await expect(getOrCreateAppFolder(MOCK_ACCESS_TOKEN)).rejects.toThrow(
        'Drive API error (401)'
      );
    });

    it('throws error when network fails', async () => {
      // Mock fetch to reject
      global.fetch = vi.fn().mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(getOrCreateAppFolder(MOCK_ACCESS_TOKEN)).rejects.toThrow(
        'Network error'
      );
    });

    it('returns first folder when multiple folders exist', async () => {
      // Edge case: multiple folders with same name
      global.fetch = vi.fn().mockResolvedValueOnce(
        createMockResponse({
          files: [
            { id: 'first-folder', name: 'Chang-Store-Gallery' },
            { id: 'second-folder', name: 'Chang-Store-Gallery' },
          ],
        })
      );

      const result = await getOrCreateAppFolder(MOCK_ACCESS_TOKEN);

      expect(result).toBe('first-folder');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
