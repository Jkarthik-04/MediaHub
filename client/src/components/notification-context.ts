import { createContext } from 'react';

export type NotificationKind = 'success' | 'error' | 'info';

export const NotificationContext = createContext<{
  notify: (message: string, kind?: NotificationKind) => void;
} | null>(null);
