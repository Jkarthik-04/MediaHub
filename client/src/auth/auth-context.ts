import { createContext } from 'react';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
};

export type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  beginGoogleSignIn: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
