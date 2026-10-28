import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { AuthUser } from '../auth/auth-context';
import { getConnectionProviders, syncConnection } from '../services/mediahub-api';

type ProfileMenuProps = { user: AuthUser; onSignOut: () => Promise<void> };

export function ProfileMenu({ user, onSignOut }: ProfileMenuProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const menuReference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('connection');
    const connectedProvider =
      result === 'anilist-success'
        ? { key: 'anilist' as const, name: 'AniList' }
        : result === 'trakt-success'
          ? { key: 'trakt' as const, name: 'Trakt' }
          : result === 'google-books-success'
            ? { key: 'google-books' as const, name: 'Google Books' }
            : null;
    if (!connectedProvider) return;
    window.history.replaceState({}, '', window.location.pathname);
    const synchronize = async () => {
      setIsOpen(true);
      setMessage(`${connectedProvider.name} was connected. Importing your library…`);
      try {
        await getConnectionProviders();
        const response = await syncConnection(connectedProvider.key);
        setMessage(
          `${connectedProvider.name} was connected and synced: ${response.data.imported} added and ${response.data.updated} updated.`,
        );
      } catch (caughtError) {
        setMessage(`${connectedProvider.name} was connected, but its first sync did not finish.`);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Open Connected apps to retry.',
        );
      }
    };
    queueMicrotask(() => void synchronize());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuReference.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const toggleMenu = () => {
    setIsOpen((open) => !open);
    setError('');
    setMessage('');
  };
  const initials = user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase();

  return (
    <div className="profile-menu" ref={menuReference}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Open profile"
        className="profile-trigger"
        onClick={toggleMenu}
        type="button"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden="true">{initials || 'U'}</span>
        )}
      </button>
      {isOpen && (
        <section className="profile-card" role="dialog" aria-label="Profile">
          <div className="profile-summary">
            <strong>{user.displayName}</strong>
            <span>{user.email}</span>
          </div>
          <button
            className="profile-section-button"
            onClick={() => {
              setIsOpen(false);
              navigate('/connections');
            }}
            type="button"
          >
            <span>Connected apps</span>
            <span aria-hidden="true">→</span>
          </button>
          {error && <p className="profile-message profile-message-error">{error}</p>}
          {message && <p className="profile-message">{message}</p>}
          <button
            className="button button-secondary"
            onClick={() => void onSignOut()}
            type="button"
          >
            Sign out
          </button>
        </section>
      )}
    </div>
  );
}
