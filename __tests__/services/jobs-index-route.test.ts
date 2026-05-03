import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DB } from '../../server/db';

describe('jobs index route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects unsupported methods before creating a DB pool or reading the session', async () => {
    const db: DB = { query: vi.fn(), withTransaction: vi.fn() };
    const getNeonPool = vi.fn(() => db);
    const getAuthenticatedSessionFromRequest = vi.fn();

    vi.doMock('../../server/neon', () => ({ getNeonPool }));
    vi.doMock('../../api/_lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../api/_lib/auth')>('../../api/_lib/auth');
      return {
        ...actual,
        getAuthenticatedSessionFromRequest,
      };
    });

    const route = await import('../../api/jobs/index');
    const response = await route.default.fetch(new Request('https://example.com/api/jobs', {
      method: 'OPTIONS',
    }));

    expect(response.status).toBe(405);
    expect(getNeonPool).not.toHaveBeenCalled();
    expect(getAuthenticatedSessionFromRequest).not.toHaveBeenCalled();
  });
});
