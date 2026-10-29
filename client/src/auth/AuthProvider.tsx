import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, apiClient } from '../services/api-client';
import { AuthContext, type AuthUser } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient<{ data: AuthUser }>('/auth/me');
      setUser(response.data);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await apiClient<void>('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const beginGoogleSignIn = useCallback(() => {
    window.location.assign('/api/v1/auth/google');
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, refresh, signOut, beginGoogleSignIn }),
    [user, isLoading, refresh, signOut, beginGoogleSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
