declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      displayName: string;
      avatarUrl: string | null;
      role: 'USER' | 'ADMIN';
    }
  }
}

export {};
