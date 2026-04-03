/**
 * GoogleDriveContext Unit Tests
 *
 * Tests for GoogleDriveProvider and useGoogleDrive hook.
 * Validates initial state and proper context usage.
 * Mocks google.accounts.oauth2 for GIS testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { GoogleDriveProvider, useGoogleDrive } from '@/contexts/GoogleDriveContext';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

/** Mock token client for GIS */
const mockTokenClient = {
  requestAccessToken: vi.fn(),
};

/** Mock Google accounts oauth2 namespace */
const mockGoogleAccounts = {
  oauth2: {
    initTokenClient: vi.fn(() => mockTokenClient),
    hasGrantedAllScopes: vi.fn(() => true),
    revoke: vi.fn(),
  },
};

// -----------------------------------------------------------------------------
// Test Utilities
// -----------------------------------------------------------------------------

/**
 * Wrapper component providing GoogleDriveProvider context
 */
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <GoogleDriveProvider>{children}</GoogleDriveProvider>;
  };
}

// -----------------------------------------------------------------------------
// Test Suites
// -----------------------------------------------------------------------------

describe('GoogleDriveContext', () => {
  // Store original env and google object
  const originalEnv = process.env;
  const originalGoogle = (global as unknown as { google?: unknown }).google;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock environment variable
    process.env = { ...originalEnv, GOOGLE_CLIENT_ID: 'mock-client-id' };

    // Mock global google object
    (global as unknown as { google: typeof mockGoogleAccounts }).google = mockGoogleAccounts;
  });

  afterEach(() => {
    // Restore originals
    process.env = originalEnv;
    (global as unknown as { google?: unknown }).google = originalGoogle;
  });

  describe('useGoogleDrive hook', () => {
    it('throws error when used outside GoogleDriveProvider', () => {
      // Suppress console.error for cleaner test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useGoogleDrive());
      }).toThrow('useGoogleDrive must be used within a GoogleDriveProvider');

      consoleSpy.mockRestore();
    });

    it('returns context value when used within provider', () => {
      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(typeof result.current.signIn).toBe('function');
      expect(typeof result.current.signOut).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('initial state', () => {
    it('isConnected is false initially', () => {
      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isConnected).toBe(false);
    });

    it('user is null initially', () => {
      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      expect(result.current.user).toBeNull();
    });

    it('accessToken is null initially', () => {
      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      expect(result.current.accessToken).toBeNull();
    });

    it('isAuthenticating is false initially', () => {
      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAuthenticating).toBe(false);
    });

    it('authError is null initially', () => {
      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      expect(result.current.authError).toBeNull();
    });
  });

  describe('legacy session cleanup', () => {
    it('removes legacy persisted Google Drive session keys on mount', () => {
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

      renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      expect(removeItemSpy).toHaveBeenCalledWith('gdrive_connected');
      expect(removeItemSpy).toHaveBeenCalledWith('gdrive_access_token');
      expect(removeItemSpy).toHaveBeenCalledWith('gdrive_token_expires_at');
      expect(removeItemSpy).toHaveBeenCalledWith('gdrive_user');

      removeItemSpy.mockRestore();
    });
  });

  describe('signIn', () => {
    it('sets error when GOOGLE_CLIENT_ID is not configured', () => {
      // Remove client ID
      process.env = { ...process.env, GOOGLE_CLIENT_ID: undefined };

      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.signIn();
      });

      expect(result.current.authError).toContain('Google Client ID not configured');
    });
  });

  describe('signOut', () => {
    it('clears all state', () => {
      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.signOut();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
      expect(result.current.authError).toBeNull();
    });
  });

  describe('clearError', () => {
    it('sets authError to null', () => {
      // Remove client ID to trigger error
      process.env = { ...process.env, GOOGLE_CLIENT_ID: undefined };

      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      // Trigger error
      act(() => {
        result.current.signIn();
      });

      expect(result.current.authError).not.toBeNull();

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.authError).toBeNull();
    });
  });

  describe('GIS initialization', () => {
    it('warns when GOOGLE_CLIENT_ID not configured', () => {
      // Remove client ID to trigger warning
      process.env = { ...process.env, GOOGLE_CLIENT_ID: undefined };
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GOOGLE_CLIENT_ID not configured')
      );

      consoleSpy.mockRestore();
    });

    it('handles missing google object gracefully', async () => {
      // Remove google object
      (global as unknown as { google?: unknown }).google = undefined;

      // Should not throw, just warn
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useGoogleDrive(), {
        wrapper: createWrapper(),
      });

      // Context should still work with null token client
      expect(result.current.isConnected).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
