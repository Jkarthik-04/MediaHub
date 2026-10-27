import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { useNotifications } from './useNotifications';

const navigation = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/discovery', label: 'Discovery' },
  { to: '/reading', label: 'Reading' },
  { to: '/watching', label: 'Watching' },
  { to: '/recommendations', label: 'Recommendations' },
  { to: '/connections', label: 'Connections' },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const { notify } = useNotifications();
  const visibleNavigation =
    user?.role === 'ADMIN' ? [...navigation, { to: '/admin', label: 'Admin' }] : navigation;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      notify('Unable to sign out. Please try again.', 'error');
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-content">
          <NavLink className="brand" to="/">
            <span className="brand-mark" aria-hidden="true">
              M
            </span>
            <span>MediaHub</span>
          </NavLink>
          <nav className="primary-navigation" aria-label="Primary navigation">
            {visibleNavigation.map(({ to, label, end }) => (
              <NavLink
                className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
                end={end}
                key={to}
                to={to}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="account-controls">
            <span className="account-name" title={user?.email}>
              {user?.displayName}
            </span>
            <button
              className="button button-secondary button-compact"
              onClick={handleSignOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="page-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
