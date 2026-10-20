import { NavLink, Outlet } from 'react-router-dom';

const navigation = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/discovery', label: 'Discovery' },
  { to: '/reading', label: 'Reading' },
  { to: '/watching', label: 'Watching' },
  { to: '/recommendations', label: 'Recommendations' },
  { to: '/admin', label: 'Admin' },
];

export function AppShell() {
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
            {navigation.map(({ to, label, end }) => (
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
          <span className="development-badge" title="Authentication is not implemented yet.">
            Development UI
          </span>
        </div>
      </header>
      <main className="page-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
