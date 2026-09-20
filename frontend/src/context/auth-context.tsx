'use client';

import * as React from 'react';

import {
  SESSION_EXPIRED_EVENT,
  authService,
  persistToken,
  readStoredToken,
  setAccessToken,
  toApiFailure,
} from '@/services/api';
import type { TokenResponse, User } from '@/types/api';

/**
 * Session state.
 *
 * The backend issues a stateless bearer token (`POST /auth/login`). frontend-2
 * keeps that exact contract: the token is stored client-side, attached as
 * `Authorization: Bearer …`, and cleared on 401. No session cookie, no auth
 * proxy, nothing the backend has to change.
 */
interface AuthContextValue {
  user: User | null;
  /** True until the stored token has been validated against `GET /auth/me`. */
  loading: boolean;
  /** True when a stored token exists but was rejected (session expired). */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<TokenResponse>;
  /**
   * Replace the session token after a server-side rotation (password change or
   * session revocation), which invalidates every token issued before it.
   */
  rotateToken: (token: string) => Promise<User>;
  /** Adopt a token minted elsewhere — the OAuth callback hands it over. */
  adoptToken: (token: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  const loadUser = React.useCallback(async () => {
    const token = readStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setAccessToken(token);
    try {
      const me = await authService.me();
      setUser(me);
      setSessionExpired(false);
    } catch (error) {
      const failure = toApiFailure(error);
      setAccessToken(null);
      persistToken(null);
      setUser(null);
      if (failure.kind === 'unauthorized') setSessionExpired(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // The axios interceptor clears the token on any 401; reflect that in state so
  // screens can render "session expired" instead of an empty workspace.
  React.useEffect(() => {
    const handler = () => {
      setUser(null);
      setSessionExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, []);

  const applyToken = React.useCallback(async (token: string) => {
    setAccessToken(token);
    persistToken(token);
    const me = await authService.me();
    setUser(me);
    setSessionExpired(false);
    return me;
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const data = await authService.login({ email, password });
      await applyToken(data.access_token);
    },
    [applyToken]
  );

  const signUp = React.useCallback(
    async (email: string, password: string, fullName: string) => {
      const data = await authService.signup({ email, password, full_name: fullName });
      await applyToken(data.access_token);
      return data;
    },
    [applyToken]
  );

  const adoptToken = React.useCallback(
    async (token: string) => applyToken(token),
    [applyToken]
  );

  const rotateToken = adoptToken;

  const logout = React.useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Recording the audit event is best-effort; signing out locally is not.
    }
    setAccessToken(null);
    persistToken(null);
    setUser(null);
    setSessionExpired(false);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionExpired,
      login,
      signUp,
      adoptToken,
      rotateToken,
      logout,
      refresh: loadUser,
      setUser,
    }),
    [user, loading, sessionExpired, login, signUp, adoptToken, rotateToken, logout, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
