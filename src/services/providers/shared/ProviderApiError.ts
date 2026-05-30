/**
 * Typed error for provider (Grok / GPT Image) API failures.
 *
 * Services throw this on any non-2xx response so that retry logic and UI can
 * evaluate the error by type and status code rather than string matching.
 */
export class ProviderApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ProviderApiError';
    this.status = status;
    this.code = code;
    // Restore prototype chain for instanceof checks after transpilation.
    Object.setPrototypeOf(this, ProviderApiError.prototype);
  }
}

/**
 * Error thrown when a provider returns a response the studio cannot turn into a
 * local image (for example, URL-only output when b64_json was requested).
 */
export class ProviderUnsupportedResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderUnsupportedResponseError';
    Object.setPrototypeOf(this, ProviderUnsupportedResponseError.prototype);
  }
}
