import { useAuth } from '@/context/AuthContext';

export function useAuthGuard() {
  const { user, isLoading } = useAuth();
  return { user, isLoading, isAuthenticated: !!user && !isLoading };
}

export function useRequireAuth() {
  const { user, isLoading, logout } = useAuth();
  
  return { user, isLoading, isAuthenticated: !!user, logout };
}