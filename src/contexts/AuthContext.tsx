import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthenticatedUser } from '../types';
import * as authService from '../services/authService';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

interface AuthContextType {
  user: AuthenticatedUser | null;
  status: AuthStatus;
  isAuthenticating: boolean;
  authError: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const refreshGenerationRef = useRef(0);

  const refreshSession = useCallback(async () => {
    const refreshGeneration = refreshGenerationRef.current + 1;
    refreshGenerationRef.current = refreshGeneration;
    setStatus('checking');
    setAuthError(null);

    try {
      const activeUser = await authService.getSession();
      if (refreshGenerationRef.current !== refreshGeneration) return;
      setUser(activeUser);
      setStatus(activeUser ? 'authenticated' : 'anonymous');
    } catch (error) {
      if (refreshGenerationRef.current !== refreshGeneration) return;
      setUser(null);
      setStatus('anonymous');
      setAuthError(error instanceof Error ? error.message : 'Unable to restore session.');
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (username: string, password: string) => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      await refreshSession();
      const nextUser = await authService.login(username, password);
      setUser(nextUser);
      setStatus('authenticated');
    } catch (error) {
      setUser(null);
      setStatus('anonymous');
      setAuthError(error instanceof Error ? error.message : 'Login failed.');
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [refreshSession]);

  const logout = useCallback(async () => {
    refreshGenerationRef.current += 1;
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      await authService.logout();
    } finally {
      setUser(null);
      setStatus('anonymous');
      setIsAuthenticating(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    status,
    isAuthenticating,
    authError,
    login,
    logout,
    refreshSession,
    clearError,
  }), [authError, clearError, isAuthenticating, login, logout, refreshSession, status, user]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
