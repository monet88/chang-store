import { describe, expect, it } from 'vitest';
import { toGatewayError } from '../src/http/error-response.js';

describe('error response mapping', () => {
  it('maps non-Error thrown details without leaking raw 500 messages', () => {
    const error = toGatewayError('plain failure');

    expect(error.status).toBe(500);
    expect(error.code).toBe('INTERNAL');
    expect(error.message).toBe('Internal gateway error.');
  });

  it('does not throw while mapping non-Error values with unsafe coercion hooks', () => {
    const error = toGatewayError({
      toString() {
        throw new Error('coercion exploded');
      },
    });

    expect(error.status).toBe(500);
    expect(error.code).toBe('INTERNAL');
    expect(error.message).toBe('Internal gateway error.');
  });
});
