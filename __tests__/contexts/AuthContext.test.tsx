import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const authServiceMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/services/authService', () => authServiceMocks);

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authServiceMocks.getSession.mockResolvedValue(null);
    authServiceMocks.login.mockResolvedValue({
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded',
    });
    authServiceMocks.logout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws outside of AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  it('hydrates to anonymous when no active session exists', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.status).toBe('anonymous');
    });
    expect(result.current.user).toBeNull();
  });


  it('clears stale authError after a successful refreshSession', async () => {
    authServiceMocks.getSession
      .mockRejectedValueOnce(new Error('restore failed'))
      .mockResolvedValueOnce({
        username: 'demo',
        displayName: 'Demo User',
        provisioning: 'seeded',
      });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.authError).toBe('restore failed'));

    await act(async () => {
      await result.current.refreshSession();
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.authError).toBeNull();
    expect(result.current.user?.username).toBe('demo');
  });

  it('returns to anonymous after logout', async () => {
    authServiceMocks.getSession.mockResolvedValueOnce({
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded',
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.user).toBeNull();
  });

  it('bootstraps CSRF via refreshSession before calling login', async () => {
    authServiceMocks.login.mockResolvedValue({
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded',
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(async () => {
      await result.current.login('demo', 'demo1234');
    });

    // getSession called once by initial useEffect, then again by login CSRF bootstrap
    expect(authServiceMocks.getSession).toHaveBeenCalledTimes(2);

    // getSession must have been called before login
    const getSessionCalls = authServiceMocks.getSession.mock.invocationCallOrder;
    const loginCall = authServiceMocks.login.mock.invocationCallOrder[0];
    expect(getSessionCalls[getSessionCalls.length - 1]).toBeLessThan(loginCall);
  });

  it('blocks login when CSRF bootstrap fails and login is rejected', async () => {
    // Simulate getSession failure (network down) during login CSRF bootstrap
    authServiceMocks.getSession
      .mockResolvedValueOnce(null) // initial useEffect -> anonymous
      .mockRejectedValueOnce(new Error('Network error')); // login bootstrap fails

    authServiceMocks.login.mockRejectedValueOnce(new Error('CSRF validation failed.'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(async () => {
      await expect(result.current.login('demo', 'demo1234'))
        .rejects.toThrow('CSRF validation failed.');
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.user).toBeNull();
  });
});
