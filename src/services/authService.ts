import type { AuthenticatedUser } from '../types';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

function getCsrfToken(): string | null {
  return document.cookie.split('; ').find(row => row.startsWith(CSRF_COOKIE_NAME + '='))?.split('=')[1] ?? null;
}

interface AuthResponseBody {
  user: AuthenticatedUser | null;
  message?: string;
}

async function readAuthResponse(response: Response): Promise<AuthResponseBody> {
  try {
    return (await response.json()) as AuthResponseBody;
  } catch {
    return {
      user: null,
      message: 'Unexpected server response.',
    };
  }
}

export async function getSession(): Promise<AuthenticatedUser | null> {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401) {
    return null;
  }

  const body = await readAuthResponse(response);
  if (!response.ok) {
    throw new Error(body.message || 'Unable to read session.');
  }

  return body.user;
}

export async function login(username: string, password: string): Promise<AuthenticatedUser> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ username, password }),
  });

  const body = await readAuthResponse(response);
  if (!response.ok || !body.user) {
    throw new Error(body.message || 'Login failed.');
  }

  return body.user;
}

export async function logout(): Promise<void> {
  const headers: Record<string, string> = {};
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }

  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const body = await readAuthResponse(response);
    throw new Error(body.message || 'Logout failed.');
  }
}
