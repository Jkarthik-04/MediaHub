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

declare module 'express-session' {
  interface SessionData {
    connectionOAuth?: {
      provider: 'anilist' | 'trakt';
      state: string;
      createdAt: number;
      codeVerifier?: string;
    };
  }
}

export {};
