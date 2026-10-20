import { Navigate, useLocation } from 'react-router-dom';

import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../auth/useAuth';

export function LoginPage() {
  const { user, isLoading, beginGoogleSignIn } = useAuth();
  const location = useLocation();
  const authFailed = new URLSearchParams(location.search).get('auth') === 'failed';

  if (!isLoading && user) return <Navigate replace to="/" />;

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="brand-mark" aria-hidden="true">
          M
        </span>
        <PageHeader eyebrow="Welcome to MediaHub" title="Your media, in one place.">
          Sign in with Google to safely track your reading and watching progress.
        </PageHeader>
        {authFailed ? (
          <p className="form-error">Google sign-in did not complete. Please try again.</p>
        ) : null}
        <button
          className="button button-primary"
          disabled={isLoading}
          onClick={beginGoogleSignIn}
          type="button"
        >
          Continue with Google
        </button>
      </section>
    </main>
  );
}
