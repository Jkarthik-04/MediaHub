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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [failedLogos, setFailedLogos] = useState<string[]>([]);

  const loadProviders = async () => {
    setLoading(true);
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
    void loadProviders();
  }, []);

  const runSync = async (provider: ConnectionProvider) => {
    setBusy(provider.key);
    setError('');
    try {
      const response = await syncConnection(provider.key);
      setMessage(
        `${provider.name}: ${response.data.imported} added, ${response.data.updated} updated.`,
      );
      await loadProviders();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sync account.');
    } finally {
      setBusy(null);
    }
  };

  const removeConnection = async (provider: ConnectionProvider) => {
    setBusy(provider.key);
    setError('');
    try {
      await disconnectProvider(provider.key);
      setMessage(`${provider.name} was disconnected.`);
      await loadProviders();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unable to disconnect account.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Your account" title="Connected apps">
        Link supported media websites to import your existing lists and progress into MediaHub.
      </PageHeader>
      <section className="surface">
        <h2>Manage connected websites</h2>
        <p>
          Provider passwords are never entered or stored here. Imported titles pass through the
          duplicate-checking workflow before they are added to your library.
        </p>
      </section>
      {error && <div className="surface profile-message-error">{error}</div>}
      {message && <div className="surface profile-message">{message}</div>}
      {loading ? (
        <div className="surface">Loading connected apps…</div>
      ) : (
        <section className="metric-grid" aria-label="Connected apps">
          {providers.map((provider) => {
            const connection = provider.connection;
            const logoFailed = failedLogos.includes(provider.key);
            return (
              <article className="surface" key={provider.key}>
                <div className="provider-card-heading">
                  {logoFailed ? (
                    <span className="provider-logo-fallback" aria-hidden="true">
                      {provider.name.slice(0, 1)}
                    </span>
                  ) : (
                    <img
                      className="provider-logo"
                      src={provider.logoUrl}
                      alt={`${provider.name} logo`}
                      onError={() =>
                        setFailedLogos((current) => [...new Set([...current, provider.key])])
                      }
                    />
                  )}
                  <div>
                    <p className="eyebrow">{provider.media.join(' · ')}</p>
                    <h2>{provider.name}</h2>
                  </div>
                </div>
                <p>{provider.description}</p>
                <p className="muted">
                  {connection
                    ? `${connection.status}${connection.externalUsername ? ` · ${connection.externalUsername}` : ''}`
                    : 'Not connected'}
                </p>
                {connection ? (
                  <div className="control-row">
                    {provider.syncAvailable && (
                      <button
                        className="button button-primary"
                        disabled={busy === provider.key}
                        onClick={() => void runSync(provider)}
                        type="button"
                      >
                        {busy === provider.key ? 'Working…' : 'Sync now'}
                      </button>
                    )}
                    <button
                      className="button button-secondary"
                      disabled={busy === provider.key}
                      onClick={() => void removeConnection(provider)}
                      type="button"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    className="button button-primary"
                    disabled={!provider.connectAvailable}
                    onClick={() => window.location.assign(getProviderConnectUrl(provider.key))}
                    type="button"
                  >
                    {provider.connectAvailable ? 'Connect' : 'Unavailable'}
                  </button>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
