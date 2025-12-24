/**
 * Unit Tests for AIVideoAuto Service
 *
 * Tests all 5 exported functions:
 * 1. listModels - Get model list with polyfill logic
 * 2. uploadImage - Upload image with multiple response structures
 * 3. createImage - Generate/edit image with polling workflow
 * 4. createVideoTask - Create video generation task
 * 5. pollForVideo - Poll video status with retries
 *
 * Uses vitest with fake timers for polling tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock axios before importing the service
vi.mock('axios', async () => {
  const mockAxiosInstance = {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      get: vi.fn(), // Direct axios.get for image download
    },
    AxiosError: class AxiosError extends Error {},
  };
});

// Import service after mocking
import {
  listModels,
  uploadImage,
  createImage,
  createVideoTask,
  pollForVideo,
} from '../../services/aivideoautoService';
import axios from 'axios';

// Access the mock instance created by axios.create()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAxiosInstance = (axios.create as any)() as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

// ============================================================================
// Test Constants
// ============================================================================

/** Test access token for API calls */
const TEST_ACCESS_TOKEN = 'test-token-123';

/** Sample image file for upload tests */
const TEST_IMAGE_FILE = {
  base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  mimeType: 'image/png',
};

/** Sample model data from API */
const MOCK_MODEL_DATA = {
  id_base: 'model-001',
  name: 'Test Model',
  description: 'A test model',
};

// ============================================================================
// Test Suite: listModels
// ============================================================================

describe('listModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Successfully retrieves model list with valid id_base
   * Verifies the function returns models as-is when id_base exists
   */
  it('should return models with existing id_base', async () => {
    // Arrange: API returns models with id_base
    const mockModels = [
      { id_base: 'model-001', name: 'Model 1' },
      { id_base: 'model-002', name: 'Model 2' },
    ];
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { data: mockModels },
    });

    // Act
    const result = await listModels(TEST_ACCESS_TOKEN, 'image');

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].id_base).toBe('model-001');
    expect(result[1].id_base).toBe('model-002');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/models', {
      access_token: TEST_ACCESS_TOKEN,
      domain: 'aivideoauto.com',
      type: 'image',
    });
  });

  /**
   * Test: Polyfills missing id_base from alternative fields
   * Verifies fallback logic: id -> _id -> model -> generated
   */
  it('should polyfill id_base when missing using id field', async () => {
    // Arrange: Model without id_base but has id
    const mockModels = [{ id: 'fallback-id', name: 'Model Without id_base' }];
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { data: mockModels },
    });

    // Act
    const result = await listModels(TEST_ACCESS_TOKEN, 'video');

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].id_base).toBe('fallback-id');
  });

  /**
   * Test: Polyfills missing id_base from _id field
   */
  it('should polyfill id_base from _id field', async () => {
    // Arrange
    const mockModels = [{ _id: 'mongo-id-123', name: 'MongoDB Model' }];
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { data: mockModels },
    });

    // Act
    const result = await listModels(TEST_ACCESS_TOKEN, 'image');

    // Assert
    expect(result[0].id_base).toBe('mongo-id-123');
  });

  /**
   * Test: Polyfills missing id_base from model field
   */
  it('should polyfill id_base from model field', async () => {
    // Arrange
    const mockModels = [{ model: 'model-name-id', name: 'Model Field ID' }];
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { data: mockModels },
    });

    // Act
    const result = await listModels(TEST_ACCESS_TOKEN, 'image');

    // Assert
    expect(result[0].id_base).toBe('model-name-id');
  });

  /**
   * Test: Generates random id_base when no fallback fields exist
   */
  it('should generate id_base when no fallback fields available', async () => {
    // Arrange: Model with no ID fields at all
    const mockModels = [{ name: 'Model Without Any ID' }];
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { data: mockModels },
    });

    // Act
    const result = await listModels(TEST_ACCESS_TOKEN, 'image');

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].id_base).toMatch(/^generated-[a-z0-9]+$/);
  });

  /**
   * Test: Returns empty array when API returns non-array data
   */
  it('should return empty array when data is not an array', async () => {
    // Arrange: API returns object instead of array
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { data: { single: 'object' } },
    });

    // Act
    const result = await listModels(TEST_ACCESS_TOKEN, 'image');

    // Assert
    expect(result).toEqual([]);
  });

  /**
   * Test: Returns empty array when data is null
   */
  it('should handle null data gracefully', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { data: null },
    });

    // Act
    const result = await listModels(TEST_ACCESS_TOKEN, 'video');

    // Assert
    expect(result).toEqual([]);
  });

  /**
   * Test: Propagates API errors
   */
  it('should throw error when API fails', async () => {
    // Arrange
    const apiError = new Error('Network error');
    mockAxiosInstance.post.mockRejectedValueOnce(apiError);

    // Act & Assert
    await expect(listModels(TEST_ACCESS_TOKEN, 'image')).rejects.toThrow('Network error');
  });
});

// ============================================================================
// Test Suite: uploadImage
// ============================================================================

describe('uploadImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Extracts id_base and url from direct properties
   */
  it('should extract id_base and url from direct properties', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        id_base: 'uploaded-image-001',
        url: 'https://cdn.example.com/image.png',
      },
    });

    // Act
    const result = await uploadImage(TEST_ACCESS_TOKEN, TEST_IMAGE_FILE);

    // Assert
    expect(result).toEqual({
      id_base: 'uploaded-image-001',
      url: 'https://cdn.example.com/image.png',
    });
  });

  /**
   * Test: Extracts id_base and url from nested imageInfo object
   */
  it('should extract from imageInfo property', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        imageInfo: {
          id_base: 'nested-image-002',
          url: 'https://cdn.example.com/nested.png',
        },
      },
    });

    // Act
    const result = await uploadImage(TEST_ACCESS_TOKEN, TEST_IMAGE_FILE);

    // Assert
    expect(result).toEqual({
      id_base: 'nested-image-002',
      url: 'https://cdn.example.com/nested.png',
    });
  });

  /**
   * Test: Extracts id_base and url from nested data object
   */
  it('should extract from data property', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        data: {
          id_base: 'data-nested-003',
          url: 'https://cdn.example.com/data.png',
        },
      },
    });

    // Act
    const result = await uploadImage(TEST_ACCESS_TOKEN, TEST_IMAGE_FILE);

    // Assert
    expect(result).toEqual({
      id_base: 'data-nested-003',
      url: 'https://cdn.example.com/data.png',
    });
  });

  /**
   * Test: Throws error when required fields are missing
   */
  it('should throw error when id_base is missing', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { url: 'https://cdn.example.com/image.png' },
    });

    // Act & Assert
    await expect(uploadImage(TEST_ACCESS_TOKEN, TEST_IMAGE_FILE)).rejects.toThrow(
      /Tải lên ảnh thất bại/
    );
  });

  /**
   * Test: Throws error when url is missing
   */
  it('should throw error when url is missing', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { id_base: 'image-without-url' },
    });

    // Act & Assert
    await expect(uploadImage(TEST_ACCESS_TOKEN, TEST_IMAGE_FILE)).rejects.toThrow(
      /Tải lên ảnh thất bại/
    );
  });

  /**
   * Test: Strips data URL prefix from base64
   */
  it('should strip data URL prefix before upload', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { id_base: 'stripped-001', url: 'https://cdn.example.com/image.png' },
    });

    // Act
    await uploadImage(TEST_ACCESS_TOKEN, TEST_IMAGE_FILE);

    // Assert: Check that base64 data was sent without prefix
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/image-upload',
      expect.objectContaining({
        data: expect.not.stringContaining('data:image'),
      })
    );
  });

  /**
   * Test: Handles raw base64 without data URL prefix
   */
  it('should handle raw base64 without prefix', async () => {
    // Arrange
    const rawBase64Image = {
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
      mimeType: 'image/png',
    };
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { id_base: 'raw-001', url: 'https://cdn.example.com/raw.png' },
    });

    // Act
    const result = await uploadImage(TEST_ACCESS_TOKEN, rawBase64Image);

    // Assert
    expect(result.id_base).toBe('raw-001');
  });
});

// ============================================================================
// Test Suite: createImage
// ============================================================================

describe('createImage', () => {
  // Store original FileReader
  let OriginalFileReader: typeof FileReader;

  beforeEach(() => {
    vi.clearAllMocks();
    OriginalFileReader = global.FileReader;
  });

  afterEach(() => {
    global.FileReader = OriginalFileReader;
    vi.useRealTimers();
  });

  /**
   * Test: Full success flow - upload, create, poll, download
   * Uses a custom FileReader mock class
   */
  it('should complete full image generation flow', async () => {
    vi.useFakeTimers();

    // Arrange: Mock upload response
    const uploadResponse = {
      data: { id_base: 'upload-001', url: 'https://cdn.example.com/upload.png' },
    };

    // Mock create response
    const createResponse = {
      data: { imageInfo: { id_base: 'gen-image-001' } },
    };

    // Mock status responses (first pending, then success)
    const pendingStatus = {
      data: { status: 'PENDING_PROCESSING' },
    };
    const successStatus = {
      data: { status: 'SUCCESS', url: 'https://cdn.example.com/result.png' },
    };

    // Setup mock call sequence
    mockAxiosInstance.post
      .mockResolvedValueOnce(uploadResponse) // uploadImage call
      .mockResolvedValueOnce(createResponse) // generateImage call
      .mockResolvedValueOnce(pendingStatus) // first poll
      .mockResolvedValueOnce(successStatus); // second poll

    // Mock image download
    const mockBlob = { type: 'image/png' };
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockBlob,
    });

    // Create a proper FileReader mock class
    class MockFileReader {
      result: string | ArrayBuffer | null = 'data:image/png;base64,dGVzdC1pbWFnZS1kYXRh';
      onloadend: (() => void) | null = null;
      onerror: ((error: Error) => void) | null = null;

      readAsDataURL() {
        // Immediately trigger onloadend
        queueMicrotask(() => {
          if (this.onloadend) this.onloadend();
        });
      }
    }
    global.FileReader = MockFileReader as unknown as typeof FileReader;

    // Act
    const resultPromise = createImage(TEST_ACCESS_TOKEN, {
      model: 'test-model',
      prompt: 'A beautiful landscape',
      subjects: [TEST_IMAGE_FILE],
    });

    // Advance timers for polling
    await vi.advanceTimersByTimeAsync(3000); // First poll interval
    await vi.advanceTimersByTimeAsync(3000); // Second poll interval
    await vi.runAllTimersAsync(); // Ensure microtasks run

    const result = await resultPromise;

    // Assert
    expect(result).toEqual({
      base64: 'dGVzdC1pbWFnZS1kYXRh',
      mimeType: 'image/png',
    });
    expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4);
  });

  /**
   * Test: Throws error when image creation returns no ID
   */
  it('should throw error when no image ID returned', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {}, // No imageInfo or id_base
    });

    // Act & Assert
    await expect(
      createImage(TEST_ACCESS_TOKEN, {
        model: 'test-model',
        prompt: 'Test prompt',
      })
    ).rejects.toThrow('Tạo ảnh không trả về ID hợp lệ.');
  });

  /**
   * Test: Throws error when image generation fails
   */
  it('should throw error when image status is ERROR', async () => {
    // Arrange
    const createResponse = {
      data: { id_base: 'error-image-001' },
    };
    const errorStatus = {
      data: { status: 'ERROR' },
    };

    mockAxiosInstance.post
      .mockResolvedValueOnce(createResponse)
      .mockResolvedValueOnce(errorStatus);

    // Act & Assert
    await expect(
      createImage(TEST_ACCESS_TOKEN, {
        model: 'test-model',
        prompt: 'Test prompt',
      })
    ).rejects.toThrow('Tạo ảnh thất bại.');
  });

  /**
   * Test: Throws timeout error after max polling attempts
   * Uses mocked setTimeout to speed up the test
   */
  it('should throw timeout error after max attempts', async () => {
    // Arrange
    const createResponse = {
      data: { id_base: 'timeout-image-001' },
    };
    const pendingStatus = {
      data: { status: 'PENDING_PROCESSING' },
    };

    // Mock setTimeout to resolve immediately
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    });

    // Setup: Always return pending
    mockAxiosInstance.post
      .mockResolvedValueOnce(createResponse)
      .mockResolvedValue(pendingStatus);

    // Act & Assert
    await expect(
      createImage(TEST_ACCESS_TOKEN, {
        model: 'test-model',
        prompt: 'Test prompt',
      })
    ).rejects.toThrow('Tạo ảnh quá thời gian sau 2 phút.');

    // Restore setTimeout
    vi.mocked(global.setTimeout).mockRestore();
  });

  /**
   * Test: Handles image without subjects (text-to-image)
   */
  it('should create image without subjects', async () => {
    vi.useFakeTimers();

    // Arrange
    const createResponse = {
      data: { id_base: 'txt2img-001' },
    };
    const successStatus = {
      data: { status: 'SUCCESS', url: 'https://cdn.example.com/generated.png' },
    };

    mockAxiosInstance.post
      .mockResolvedValueOnce(createResponse)
      .mockResolvedValueOnce(successStatus);

    const mockBlob = { type: 'image/png' };
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockBlob });

    // Create a proper FileReader mock class
    class MockFileReader {
      result: string | ArrayBuffer | null = 'data:image/png;base64,ZGF0YQ==';
      onloadend: (() => void) | null = null;
      onerror: ((error: Error) => void) | null = null;

      readAsDataURL() {
        queueMicrotask(() => {
          if (this.onloadend) this.onloadend();
        });
      }
    }
    global.FileReader = MockFileReader as unknown as typeof FileReader;

    // Act
    const resultPromise = createImage(TEST_ACCESS_TOKEN, {
      model: 'text-to-image-model',
      prompt: 'A sunset over mountains',
    });

    await vi.runAllTimersAsync();

    const result = await resultPromise;

    // Assert
    expect(result.base64).toBe('ZGF0YQ==');
    // Verify no upload was called (no subjects)
    expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// Test Suite: createVideoTask
// ============================================================================

describe('createVideoTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Returns video ID on successful task creation
   */
  it('should return video ID on success', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        videoInfo: {
          id_base: 'video-task-001',
          status: 'PENDING',
        },
      },
    });

    // Act
    const result = await createVideoTask(TEST_ACCESS_TOKEN, {
      model: 'video-model-001',
      prompt: 'A cinematic video',
      images: [{ id_base: 'img-001', url: 'https://cdn.example.com/img.png' }],
    });

    // Assert
    expect(result).toBe('video-task-001');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/create-video',
      expect.objectContaining({
        access_token: TEST_ACCESS_TOKEN,
        domain: 'aivideoauto.com',
        model: 'video-model-001',
        prompt: 'A cinematic video',
        privacy: 'PRIVATE',
        translate_to_en: 'false',
      })
    );
  });

  /**
   * Test: Throws error when videoInfo is missing
   */
  it('should throw error when videoInfo is missing', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { success: true }, // No videoInfo
    });

    // Act & Assert
    await expect(
      createVideoTask(TEST_ACCESS_TOKEN, {
        model: 'video-model',
        prompt: 'Test video',
        images: [],
      })
    ).rejects.toThrow('Tạo tác vụ video thất bại, không nhận được ID video.');
  });

  /**
   * Test: Throws error when id_base is missing in videoInfo
   */
  it('should throw error when videoInfo.id_base is missing', async () => {
    // Arrange
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        videoInfo: { status: 'PENDING' }, // No id_base
      },
    });

    // Act & Assert
    await expect(
      createVideoTask(TEST_ACCESS_TOKEN, {
        model: 'video-model',
        prompt: 'Test video',
        images: [],
      })
    ).rejects.toThrow('Tạo tác vụ video thất bại, không nhận được ID video.');
  });
});

// ============================================================================
// Test Suite: pollForVideo
// ============================================================================

describe('pollForVideo', () => {
  /** Mock status update callback */
  const mockOnStatusUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Test: Successfully polls and returns download URL after retries
   */
  it('should return download URL after successful polling', async () => {
    // Arrange: First two calls pending, third is success
    const pendingResponse = {
      data: {
        videoInfo: {
          status: 'MEDIA_GENERATION_STATUS_PENDING',
        },
      },
    };
    const successResponse = {
      data: {
        videoInfo: {
          status: 'MEDIA_GENERATION_STATUS_SUCCESSFUL',
          download_url: 'https://cdn.example.com/video.mp4',
        },
      },
    };

    mockAxiosInstance.post
      .mockResolvedValueOnce(pendingResponse)
      .mockResolvedValueOnce(pendingResponse)
      .mockResolvedValueOnce(successResponse);

    // Act
    const resultPromise = pollForVideo(TEST_ACCESS_TOKEN, 'video-001', mockOnStatusUpdate);

    // Advance through polling intervals
    await vi.advanceTimersByTimeAsync(10000); // First poll
    await vi.advanceTimersByTimeAsync(10000); // Second poll
    await vi.advanceTimersByTimeAsync(10000); // Third poll (success)

    const result = await resultPromise;

    // Assert
    expect(result).toBe('https://cdn.example.com/video.mp4');
    expect(mockOnStatusUpdate).toHaveBeenCalledWith(
      expect.stringContaining('PENDING')
    );
    expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
  });

  /**
   * Test: Throws timeout error after max polling attempts (10 minutes)
   * Uses real timers with mocked fast-resolving responses
   */
  it('should throw timeout error after 60 attempts', async () => {
    // Use real timers for this test to avoid unhandled rejection timing issues
    vi.useRealTimers();

    // Arrange: Always return pending, but resolve immediately
    const pendingResponse = {
      data: {
        videoInfo: {
          status: 'MEDIA_GENERATION_STATUS_PENDING',
        },
      },
    };

    // Mock setTimeout to resolve immediately for fast test execution
    const originalSetTimeout = global.setTimeout;
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    });

    mockAxiosInstance.post.mockResolvedValue(pendingResponse);

    // Act & Assert
    await expect(
      pollForVideo(TEST_ACCESS_TOKEN, 'video-timeout', mockOnStatusUpdate)
    ).rejects.toThrow('Tạo video quá thời gian sau 10 phút.');

    // Restore setTimeout
    vi.mocked(global.setTimeout).mockRestore();
  });

  /**
   * Test: Throws error when video generation fails
   */
  it('should throw error when video status is FAILED', async () => {
    // Use real timers for cleaner async handling
    vi.useRealTimers();

    // Arrange
    const failedResponse = {
      data: {
        videoInfo: {
          status: 'MEDIA_GENERATION_STATUS_FAILED',
        },
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(failedResponse);

    // Act & Assert
    await expect(
      pollForVideo(TEST_ACCESS_TOKEN, 'video-fail', mockOnStatusUpdate)
    ).rejects.toThrow('Tạo video thất bại.');
  });

  /**
   * Test: Throws error when status is missing download URL
   */
  it('should throw error when success but no download_url', async () => {
    // Use real timers for cleaner async handling
    vi.useRealTimers();

    // Arrange
    const successNoUrl = {
      data: {
        videoInfo: {
          status: 'MEDIA_GENERATION_STATUS_SUCCESSFUL',
          // Missing download_url
        },
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(successNoUrl);

    // Act & Assert
    await expect(
      pollForVideo(TEST_ACCESS_TOKEN, 'video-no-url', mockOnStatusUpdate)
    ).rejects.toThrow('Tạo video thành công nhưng không có URL tải xuống.');
  });

  /**
   * Test: Throws error when status property is invalid
   */
  it('should throw error when status is not a string', async () => {
    // Use real timers for cleaner async handling
    vi.useRealTimers();

    // Arrange
    const invalidStatus = {
      data: {
        videoInfo: {
          status: 123, // Not a string
        },
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(invalidStatus);

    // Act & Assert
    await expect(
      pollForVideo(TEST_ACCESS_TOKEN, 'video-invalid', mockOnStatusUpdate)
    ).rejects.toThrow('Trạng thái video không hợp lệ nhận được từ API.');
  });

  /**
   * Test: Handles response nested in data property
   */
  it('should handle response nested in data property', async () => {
    // Use real timers for cleaner async handling
    vi.useRealTimers();

    // Arrange
    const nestedResponse = {
      data: {
        data: {
          status: 'MEDIA_GENERATION_STATUS_SUCCESSFUL',
          download_url: 'https://cdn.example.com/nested-video.mp4',
        },
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(nestedResponse);

    // Act
    const result = await pollForVideo(TEST_ACCESS_TOKEN, 'video-nested', mockOnStatusUpdate);

    // Assert
    expect(result).toBe('https://cdn.example.com/nested-video.mp4');
  });

  /**
   * Test: Propagates network errors
   */
  it('should propagate network errors', async () => {
    // Use real timers for cleaner async handling
    vi.useRealTimers();

    // Arrange
    mockAxiosInstance.post.mockRejectedValueOnce(new Error('Network failure'));

    // Act & Assert
    await expect(
      pollForVideo(TEST_ACCESS_TOKEN, 'video-error', mockOnStatusUpdate)
    ).rejects.toThrow('Network failure');
  });

  /**
   * Test: Updates status callback with friendly status message
   */
  it('should strip status prefix when calling onStatusUpdate', async () => {
    // Use real timers for cleaner async handling
    vi.useRealTimers();

    // Arrange
    const processingResponse = {
      data: {
        videoInfo: {
          status: 'MEDIA_GENERATION_STATUS_SUCCESSFUL',
          download_url: 'https://cdn.example.com/video.mp4',
        },
      },
    };
    mockAxiosInstance.post.mockResolvedValueOnce(processingResponse);

    // Act
    await pollForVideo(TEST_ACCESS_TOKEN, 'video-status', mockOnStatusUpdate);

    // Assert: Status prefix should be stripped
    expect(mockOnStatusUpdate).toHaveBeenCalledWith(
      expect.stringContaining('SUCCESSFUL')
    );
    expect(mockOnStatusUpdate).not.toHaveBeenCalledWith(
      expect.stringContaining('MEDIA_GENERATION_STATUS_')
    );
  });
});
