/**
 * Google Drive OAuth Context
 *
 * Provides Google Drive authentication state and methods using Google Identity Services (GIS).
 * Manages OAuth2 token lifecycle, user info fetching, and sign-in/sign-out flows.
 * Implements automatic token refresh before expiry.
 *
 * @see https://developers.google.com/identity/oauth2/web/guides/use-token-model
 */

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

/** Google user profile information */
interface GoogleUser {
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** URL to user's profile picture */
  picture: string;
}

/** Google Drive context state and methods */
interface GoogleDriveContextType {
  /** Whether user is connected to Google Drive */
  isConnected: boolean;
  /** Current authenticated user info */
  user: GoogleUser | null;
  /** Current access token (null if not authenticated) */
  accessToken: string | null;
  /** Whether authentication is in progress */
  isAuthenticating: boolean;
  /** Authentication error message */
  authError: string | null;
  /** Initiates Google OAuth sign-in flow */
  signIn: () => void;
  /** Signs out and revokes access token */
  signOut: () => void;
  /** Clears any authentication error */
  clearError: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** OAuth scopes: openid for auth, profile/email for user info, drive.file for storage */
const SCOPES = 'openid profile email https://www.googleapis.com/auth/drive.file';

/** Drive scope URL for permission check */
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Google OAuth user info endpoint */
const USER_INFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

/** Time before expiry to trigger refresh (5 minutes in ms) */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ============================================================================
// Context
// ============================================================================

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

export const GoogleDriveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- State ---
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);

  // --- Refs ---
  /** GIS token client instance */
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);
  /** Token refresh timer */
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  /** Flag to indicate silent refresh (no popup) */
  const isSilentRefreshRef = useRef(false);

  // --- User Info Fetching ---
  /**
   * Fetches user profile from Google API
   * @param token - Valid access token
   */
  const fetchUserInfo = useCallback(async (token: string): Promise<GoogleUser | null> => {
    try {
      const response = await fetch(USER_INFO_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      const data = await response.json();
      return {
        email: data.email,
        name: data.name,
        picture: data.picture
      };
    } catch (err) {
      console.error('[GoogleDrive] Failed to fetch user info:', err);
      return null;
    }
  }, []);

  // --- Token Response Handler ---
  /**
   * Handles successful token response from GIS
   */
  const handleTokenResponse = useCallback(async (response: google.accounts.oauth2.TokenResponse) => {
    // Check for error in response
    if (response.error) {
      // Silent refresh failures shouldn't show errors to user
      if (!isSilentRefreshRef.current) {
        setAuthError(response.error_description || response.error);
      }
      setIsAuthenticating(false);
      isSilentRefreshRef.current = false;
      return;
    }

    // Validate Drive scope was granted (only check Drive, not profile scopes)
    if (!google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
      if (!isSilentRefreshRef.current) {
        setAuthError('Drive permission was not granted');
      }
      setIsAuthenticating(false);
      isSilentRefreshRef.current = false;
      return;
    }

    // Store token and calculate expiry
    const token = response.access_token;
    const expiresIn = response.expires_in;
    const expiryTime = Date.now() + expiresIn * 1000;

    setAccessToken(token);
    setTokenExpiresAt(expiryTime);

    // Fetch user info and persist session
    const userInfo = await fetchUserInfo(token);
    if (userInfo) {
      setUser(userInfo);
      setIsConnected(true);
      setAuthError(null);
      console.log('[GoogleDrive] Token expires in', Math.round(expiresIn / 60), 'minutes');
    } else {
      if (!isSilentRefreshRef.current) {
        setAuthError('Failed to get user information');
      }
    }

    setIsAuthenticating(false);
    isSilentRefreshRef.current = false;
  }, [fetchUserInfo]);

  // --- Error Response Handler ---
  /**
   * Handles error response from GIS
   */
  const handleErrorResponse = useCallback((error: google.accounts.oauth2.ErrorResponse) => {
    console.error('[GoogleDrive] Auth error:', error);

    // User cancelled the popup or silent refresh failed
    if (error.type === 'popup_closed') {
      if (!isSilentRefreshRef.current) {
        setAuthError(null); // Not an error, just cancelled
      }
    } else if (!isSilentRefreshRef.current) {
      setAuthError(error.message || 'Authentication failed');
    }

    setIsAuthenticating(false);
    isSilentRefreshRef.current = false;
  }, []);

  // --- Initialize GIS Token Client ---
  useEffect(() => {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    // Skip if no client ID configured
    if (!clientId) {
      console.warn('[GoogleDrive] GOOGLE_CLIENT_ID not configured');
      return;
    }

    // Wait for GIS library to load
    const initTokenClient = () => {
      if (typeof google === 'undefined' || !google.accounts?.oauth2) {
        // Retry after a short delay
        setTimeout(initTokenClient, 100);
        return;
      }

      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: handleTokenResponse,
        error_callback: handleErrorResponse
      });
      // Note: No auto re-auth on load; access token is memory-only
    };

    initTokenClient();
  }, [handleTokenResponse, handleErrorResponse]);

  // --- Schedule Token Refresh ---
  useEffect(() => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Only schedule if connected and have expiry time
    if (!isConnected || !tokenExpiresAt || !tokenClientRef.current) {
      return;
    }

    // Calculate time until refresh (5 min before expiry)
    const timeUntilRefresh = tokenExpiresAt - Date.now() - REFRESH_BUFFER_MS;

    if (timeUntilRefresh <= 0) {
      // Token already expired or about to expire, refresh now
      console.log('[GoogleDrive] Token expired, refreshing immediately');
      isSilentRefreshRef.current = true;
      tokenClientRef.current.requestAccessToken({ prompt: '' });
      return;
    }

    // Schedule silent refresh
    console.log(`[GoogleDrive] Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
    refreshTimerRef.current = setTimeout(() => {
      if (tokenClientRef.current) {
        console.log('[GoogleDrive] Refreshing token silently...');
        isSilentRefreshRef.current = true;
        tokenClientRef.current.requestAccessToken({ prompt: '' });
      }
    }, timeUntilRefresh);

    // Cleanup on unmount or deps change
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [isConnected, tokenExpiresAt]);

  // --- Sign In ---
  const signIn = useCallback(() => {
    // Check if client ID is configured
    if (!process.env.GOOGLE_CLIENT_ID) {
      setAuthError('Google Client ID not configured. Please add GOOGLE_CLIENT_ID to your environment.');
      return;
    }

    // Check if token client is initialized
    if (!tokenClientRef.current) {
      setAuthError('Google Identity Services not loaded. Please refresh the page.');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    isSilentRefreshRef.current = false;

    // Request access token (opens popup)
    tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
  }, []);

  // --- Sign Out ---
  const signOut = useCallback(() => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Revoke token if we have one
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {
        console.log('[GoogleDrive] Token revoked');
      });
    }

    // Clear state
    setAccessToken(null);
    setTokenExpiresAt(null);
    setUser(null);
    setIsConnected(false);
    setAuthError(null);
  }, [accessToken]);

  // --- Clear Error ---
  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  // --- Context Value (memoized to prevent unnecessary re-renders) ---
  const contextValue = useMemo<GoogleDriveContextType>(() => ({
    isConnected,
    user,
    accessToken,
    isAuthenticating,
    authError,
    signIn,
    signOut,
    clearError
  }), [isConnected, user, accessToken, isAuthenticating, authError, signIn, signOut, clearError]);

  return (
    <GoogleDriveContext.Provider value={contextValue}>
      {children}
    </GoogleDriveContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access Google Drive authentication state and methods
 * @throws Error if used outside of GoogleDriveProvider
 */
export const useGoogleDrive = (): GoogleDriveContextType => {
  const context = useContext(GoogleDriveContext);

  if (context === undefined) {
    throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  }

  return context;
};
