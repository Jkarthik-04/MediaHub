import { useEffect, useState } from 'react';

import { PageHeader } from '../components/PageHeader';
import {
  disconnectProvider,
  getConnectionProviders,
  getProviderConnectUrl,
  type ConnectionProvider,
} from '../services/mediahub-api';

export function ConnectionsPage() {
  const [providers, setProviders] = useState<ConnectionProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [disconnecting, setDisconnecting] = useState<ConnectionProvider['key'] | null>(null);

  const loadProviders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getConnectionProviders();
      setProviders(response.data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load connections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('connection');
    if (result === 'anilist-success') {
      setMessage('AniList was connected successfully.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (result === 'trakt-success') {
      setMessage('Trakt was connected successfully.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (result === 'google-books-success') {
      setMessage('Google Books was connected successfully.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    void loadProviders();

    const refreshConnections = () => void loadProviders();
    window.addEventListener('focus', refreshConnections);
    return () => window.removeEventListener('focus', refreshConnections);
  }, []);

  const handleDisconnect = async (provider: ConnectionProvider) => {
    setDisconnecting(provider.key);
    setError('');
    setMessage('');
    try {
      await disconnectProvider(provider.key);
      setMessage(`${provider.name} was disconnected.`);
      await loadProviders();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unable to disconnect account.',
      );
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Your account" title="Connected websites">
        Link supported media accounts to bring your existing lists and progress into MediaHub.
      </PageHeader>

      <section className="surface">
        <h2>How connections work</h2>
        <p>
          MediaHub redirects you to the provider for approval. Provider passwords are never entered
          or stored here. Imported titles will pass through the existing duplicate-checking
          workflow.
        </p>
      </section>

      {error && (
        <div className="surface" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="surface" role="status">
          {message}
        </div>
      )}

      {loading ? (
        <div className="surface" role="status">
          Loading supported websites…
        </div>
      ) : (
        <section className="metric-grid" aria-label="Supported website connections">
          {providers.map((provider) => {
            const connection = provider.connection;
            return (
              <article className="surface" key={provider.key}>
                <p className="eyebrow">{provider.media.join(' · ')}</p>
                <h2>{provider.name}</h2>
                <p>{provider.description}</p>
                {connection ? (
                  <>
                    <p>
                      <strong>{connection.status}</strong>
                      {connection.externalUsername ? ` · ${connection.externalUsername}` : ''}
                    </p>
                    <p className="muted">
                      Last synced:{' '}
                      {connection.lastSyncedAt
                        ? new Date(connection.lastSyncedAt).toLocaleString()
                        : 'Not synced yet'}
                    </p>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={disconnecting === provider.key}
                      onClick={() => void handleDisconnect(provider)}
                    >
                      {disconnecting === provider.key ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="muted">
                      {provider.configured
                        ? 'OAuth connector implementation is the next checkpoint.'
                        : 'Provider credentials have not been configured.'}
                    </p>
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={!provider.connectAvailable}
                      onClick={() => {
                        window.location.assign(getProviderConnectUrl(provider.key));
                      }}
                    >
                      {provider.connectAvailable ? 'Connect' : 'Coming next'}
                    </button>
                  </>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
