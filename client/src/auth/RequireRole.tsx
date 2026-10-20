import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from './useAuth';

export function RequireRole({ role, children }: { role: 'ADMIN'; children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate replace to="/" />;
  return <>{children}</>;
}
