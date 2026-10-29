import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { ProfileMenu } from './ProfileMenu';

const navigation = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/discovery', label: 'Discovery' },
  { to: '/reading', label: 'Reading' },
  { to: '/watching', label: 'Watching' },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const visibleNavigation =
    user?.role === 'ADMIN' ? [...navigation, { to: '/admin', label: 'Admin' }] : navigation;

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
          {user && <ProfileMenu user={user} onSignOut={signOut} />}
        </div>
      </header>
      <main className="page-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
