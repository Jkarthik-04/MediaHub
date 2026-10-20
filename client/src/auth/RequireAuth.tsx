import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingState } from '../components/PageStates';
import { useAuth } from './useAuth';

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingState label="Checking your secure session…" />;
  if (!user) return <Navigate replace state={{ from: location }} to="/login" />;
  return <Outlet />;
}
