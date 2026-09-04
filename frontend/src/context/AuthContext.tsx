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
  logout: () => void;
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
    router.push('/dashboard');
    router.refresh();
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAccessToken(null);
    localStorage.removeItem('access_token');
    router.push('/login');
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout, refreshUser }}>
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