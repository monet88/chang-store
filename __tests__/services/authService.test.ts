import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession, login, logout } from '@/services/authService';

const fetchMock = vi.fn<typeof fetch>();

describe('authService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    document.cookie = 'csrf_token=; Max-Age=0; Path=/';
  });

  it('posts credentials with cookies and CSRF header when logging in', async () => {
    document.cookie = 'csrf_token=test-csrf-token';

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      user: {
        username: 'demo',
        displayName: 'Demo User',
        provisioning: 'seeded',
      },
    }), { status: 200 }));

    const user = await login('demo', 'demo1234');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'test-csrf-token' },
    }));
    expect(user.username).toBe('demo');
  });

  it('logs in without CSRF header when no csrf_token cookie is set', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      user: {
        username: 'demo',
        displayName: 'Demo User',
        provisioning: 'seeded',
      },
    }), { status: 200 }));

    await login('demo', 'demo1234');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  it('throws the server message when login fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid username or password.' }), { status: 401 }));

    await expect(login('demo', 'bad-pass')).rejects.toThrow('Invalid username or password.');
  });

  it('returns null on 401 session checks', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ user: null }), { status: 401 }));

    await expect(getSession()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    });
  });

  it('does not include CSRF header on GET session request', async () => {
    document.cookie = 'csrf_token=test-csrf-token';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      user: { username: 'demo', displayName: 'Demo User', provisioning: 'seeded' },
    }), { status: 200 }));

    await getSession();

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    });
  });

  it('posts logout with CSRF header when cookie is present', async () => {
    document.cookie = 'csrf_token=test-csrf-token';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await logout();

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'test-csrf-token' },
    });
  });

  it('posts logout without CSRF header when no cookie is set and receives 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'No active session.' }), { status: 401 }));

    await expect(logout()).rejects.toThrow('No active session.');
  });
});
