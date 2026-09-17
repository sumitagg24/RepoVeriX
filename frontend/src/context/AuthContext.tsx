'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authService, setAccessToken } from '@/services/api';
import type { User, TokenResponse } from '@/types/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  logoutWithAudit: () => Promise<void>;
  rotateToken: (newToken: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      setToken(storedToken);
      setAccessToken(storedToken);
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = async () => {
    try {
      const userData = await authService.me();
      setUser(userData);
    } catch {
      setToken(null);
      setAccessToken(null);
      localStorage.removeItem('access_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await authService.login({ email, password });
    setToken(data.access_token);
    setAccessToken(data.access_token);
    localStorage.setItem('access_token', data.access_token);
    await refreshUser();
    router.push('/dashboard');
    router.refresh();
  };

  const signup = async (email: string, password: string, fullName: string) => {
    const data = await authService.signup({ email, password, full_name: fullName });
    setToken(data.access_token);
    setAccessToken(data.access_token);
    localStorage.setItem('access_token', data.access_token);
    await refreshUser();
    // Dev-mode (console mail backend): the response carries the verification
    // link because no real email is sent — completing verification is the
    // actual next step. Null when SMTP is configured (production), so the
    // normal first-run flow applies.
    if (data.dev_verification_url) {
      const url = new URL(data.dev_verification_url);
      router.push(`${url.pathname}${url.search}`);
      router.refresh();
      return;
    }
    // New accounts start the guided first-run checklist (unless they arrived
    // via a pricing CTA, which lands them on the plan they picked first).
    const planParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('plan') : null;
    router.push(planParam && planParam !== 'free' ? `/billing?plan=${encodeURIComponent(planParam)}` : '/onboarding');
    router.refresh();
  };

  const loginWithToken = async (jwt: string) => {
    setToken(jwt);
    setAccessToken(jwt);
    localStorage.setItem('access_token', jwt);
    await refreshUser();
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAccessToken(null);
    localStorage.removeItem('access_token');
    router.push('/auth/login');
    router.refresh();
  };

  /** Client-side sign-out that also records the AUTH_LOGOUT audit event.
   *  Best-effort: the local session is cleared even if the API call fails. */
  const logoutWithAudit = async () => {
    try {
      await authService.logoutAudit();
    } catch {
      // Token may already be dead — clearing local state is what matters.
    }
    logout();
  };

  /** Rotate the stored token (password change / revoke-all re-issue). */
  const rotateToken = async (newToken: string) => {
    setToken(newToken);
    setAccessToken(newToken);
    localStorage.setItem('access_token', newToken);
    await refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        signup,
        loginWithToken,
        logout,
        logoutWithAudit,
        rotateToken,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}