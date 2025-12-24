/**
 * Axios Mock Module
 *
 * Provides a mocked axios instance for testing AIVideoAuto service
 * and other HTTP client integrations. Uses vitest vi.fn() for all mocks.
 */

import { vi } from 'vitest';

/**
 * Mock axios instance returned by axios.create()
 *
 * Contains mocked HTTP methods and interceptors for testing:
 * - post: Mock POST requests
 * - get: Mock GET requests
 * - interceptors: Mock request/response interceptors
 */
const mockAxiosInstance = {
  /** Mock POST method */
  post: vi.fn(),
  /** Mock GET method */
  get: vi.fn(),
  /** Mock interceptors for request/response handling */
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

/**
 * Mock axios module
 *
 * Exports create() function that returns a mock axios instance.
 * Used for testing services that create axios instances with custom config.
 */
export default {
  /** Creates a new mock axios instance */
  create: vi.fn(() => mockAxiosInstance),
};

/**
 * Export mock instance for direct test assertions
 *
 * Allows tests to configure mock responses:
 * @example
 * import axios, { mockAxiosInstance } from './__mocks__/axios';
 * mockAxiosInstance.post.mockResolvedValue({ data: { ... } });
 */
export { mockAxiosInstance };
