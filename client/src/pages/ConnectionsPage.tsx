import { useEffect, useState } from 'react';

import { PageHeader } from '../components/PageHeader';
import {
  disconnectProvider,
  getConnectionProviders,
  getProviderConnectUrl,
  syncConnection,
  type ConnectionProvider,
} from '../services/mediahub-api';

export function ConnectionsPage() {
  const [providers, setProviders] = useState<ConnectionProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [disconnecting, setDisconnecting] = useState<ConnectionProvider['key'] | null>(null);
  const [syncing, setSyncing] = useState<ConnectionProvider['key'] | null>(null);

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
    const connectedProvider =
      result === 'anilist-success'
        ? { key: 'anilist' as const, name: 'AniList' }
        : result === 'trakt-success'
          ? { key: 'trakt' as const, name: 'Trakt' }
          : result === 'google-books-success'
            ? { key: 'google-books' as const, name: 'Google Books' }
            : null;
    if (connectedProvider) {
      setMessage(`${connectedProvider.name} was connected. Importing your library…`);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const initializeConnections = async () => {
      await loadProviders();
      if (!connectedProvider) return;

      setSyncing(connectedProvider.key);
      setError('');
      try {
        const response = await syncConnection(connectedProvider.key);
        setMessage(
          `${connectedProvider.name} was connected and synced: ${response.data.imported} added and ${response.data.updated} updated.`,
        );
        await loadProviders();
      } catch (caughtError) {
        setMessage(`${connectedProvider.name} was connected, but its first sync did not finish.`);
        setError(
          caughtError instanceof Error ? caughtError.message : 'Use Sync now to retry the import.',
        );
      } finally {
        setSyncing(null);
      }
    };
    void initializeConnections();

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

  const handleSync = async (provider: ConnectionProvider) => {
    setSyncing(provider.key);
    setError('');
    setMessage('');
    try {
      const response = await syncConnection(provider.key);
      setMessage(
        `${provider.name} sync complete: ${response.data.imported} added and ${response.data.updated} updated.`,
      );
      await loadProviders();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sync account.');
    } finally {
      setSyncing(null);
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
                    {provider.syncAvailable && (
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={syncing === provider.key}
                        onClick={() => void handleSync(provider)}
                      >
                        {syncing === provider.key ? 'Syncing…' : 'Sync now'}
                      </button>
                    )}
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
                        ? 'Ready to connect securely with OAuth.'
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
