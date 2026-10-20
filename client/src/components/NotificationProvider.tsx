import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { NotificationContext, type NotificationKind } from './notification-context';

type Notification = { id: number; message: string; kind: NotificationKind };

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notify = useCallback((message: string, kind: NotificationKind = 'info') => {
    const id = Date.now();
    setNotifications((current) => [...current, { id, message, kind }]);
    window.setTimeout(
      () => setNotifications((current) => current.filter((notification) => notification.id !== id)),
      5000,
    );
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="notification-region">
        {notifications.map((notification) => (
          <div className={`notification notification-${notification.kind}`} key={notification.id}>
            <span>{notification.message}</span>
            <button
              aria-label="Dismiss notification"
              className="notification-dismiss"
              onClick={() =>
                setNotifications((current) => current.filter((item) => item.id !== notification.id))
              }
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
