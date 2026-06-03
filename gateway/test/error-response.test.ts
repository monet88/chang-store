import { describe, expect, it } from 'vitest';
import { toGatewayError } from '../src/http/error-response.js';

describe('error response mapping', () => {
  it('preserves non-Error thrown details', () => {
    const error = toGatewayError('plain failure');

    expect(error.status).toBe(500);
    expect(error.code).toBe('INTERNAL');
    expect(error.message).toBe('plain failure');
  });
});
