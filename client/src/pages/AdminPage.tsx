import { useEffect, useState } from 'react';

import { ErrorState, LoadingState } from '../components/PageStates';
import { PageHeader } from '../components/PageHeader';
import { apiClient } from '../services/api-client';

type AdminOverview = {
  activeUsers: number;
  pendingManualMedia: number;
  failedIngestionJobs: number;
  enabledSources: number;
};

export function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void apiClient<{ data: AdminOverview }>('/admin/overview')
      .then((response) => setOverview(response.data))
      .catch(() => setError(true));
  }, []);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Administration" title="Admin workspace">
        User roles, manual-title review, provider health, ingestion jobs, and audit records will be
        managed here.
      </PageHeader>
      {error ? (
        <ErrorState title="Unable to load admin summary">Try refreshing the page.</ErrorState>
      ) : null}
      {!overview && !error ? <LoadingState label="Loading protected admin data…" /> : null}
      {overview ? (
        <section className="metric-grid" aria-label="Admin summary">
          {[
            ['Active users', overview.activeUsers],
            ['Pending manual titles', overview.pendingManualMedia],
            ['Failed imports', overview.failedIngestionJobs],
            ['Enabled sources', overview.enabledSources],
          ].map(([label, value]) => (
            <article className="metric-card" key={String(label)}>
              <p>{label}</p>
              <strong>{value}</strong>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
