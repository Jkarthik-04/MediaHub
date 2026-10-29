import { useEffect, useState } from 'react';

import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { ErrorState, LoadingState } from '../components/PageStates';
import { PageHeader } from '../components/PageHeader';
import { apiClient } from '../services/api-client';

type AdminOverview = {
  activeUsers: number;
  pendingManualMedia: number;
  failedIngestionJobs: number;
  enabledSources: number;
};
type PendingManualMedia = {
  id: string;
  title: string;
  description: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  totalUnits: number | null;
  createdAt: string;
  createdByUser: { id: string; displayName: string; email: string } | null;
  mediaType: { code: string; name: string; section: string };
  genres: Array<{ name: string; slug: string }>;
};

export function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingManualMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [reviewAction, setReviewAction] = useState<{
    item: PendingManualMedia;
    decision: 'APPROVE' | 'REJECT';
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadAdminData() {
      setLoading(true);
      setError('');
      try {
        const [overviewResponse, pendingResponse] = await Promise.all([
          apiClient<{ data: AdminOverview }>('/admin/overview'),
          apiClient<{ data: PendingManualMedia[] }>('/admin/manual-media/pending'),
        ]);
        if (!cancelled) {
          setOverview(overviewResponse.data);
          setPendingMedia(pendingResponse.data);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error ? caughtError.message : 'Unable to load admin data.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAdminData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitReviewDecision() {
    if (!reviewAction) return;
    setSaving(true);
    setActionError('');
    setMessage('');
    try {
      await apiClient(`/admin/manual-media/${encodeURIComponent(reviewAction.item.id)}/review`, {
        method: 'PATCH',
        body: { decision: reviewAction.decision },
      });
      setPendingMedia((current) => current.filter((item) => item.id !== reviewAction.item.id));
      setOverview((current) =>
        current
          ? { ...current, pendingManualMedia: Math.max(0, current.pendingManualMedia - 1) }
          : current,
      );
      setMessage(
        reviewAction.decision === 'APPROVE'
          ? `${reviewAction.item.title} was approved.`
          : `${reviewAction.item.title} was rejected and removed from the active catalogue.`,
      );
      setReviewAction(null);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error ? caughtError.message : 'Unable to review title.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading protected admin data…" />;
  if (error) return <ErrorState title="Unable to load admin workspace">{error}</ErrorState>;

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Administration" title="Admin workspace">
        Review manually submitted niche titles. This page and its API actions require the ADMIN
        role.
      </PageHeader>
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {overview && (
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
      )}

      <section className="surface">
        <h2>Manual-title review queue</h2>
        {pendingMedia.length === 0 ? (
          <p className="muted">No titles are waiting for review.</p>
        ) : (
          <div className="page-stack">
            {pendingMedia.map((item) => (
              <article className="admin-review-card" key={item.id}>
                {item.coverUrl && (
                  <img src={item.coverUrl} alt={`Cover of ${item.title}`} loading="lazy" />
                )}
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.mediaType.name} · {item.mediaType.section}
                  </p>
                  <p>{item.description || 'No description provided.'}</p>
                  <p>
                    Genres: {item.genres.map((genre) => genre.name).join(', ') || 'Not specified'}
                  </p>
                  <p>
                    Submitted by {item.createdByUser?.displayName ?? 'Unknown'} ·{' '}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                  <div className="inline-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => setReviewAction({ item, decision: 'APPROVE' })}
                    >
                      Approve
                    </button>
                    <button
                      className="tab"
                      type="button"
                      onClick={() => setReviewAction({ item, decision: 'REJECT' })}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface">
        <h2>Other admin operations</h2>
        <p className="muted">
          The current server API does not expose user/role management, metadata correction or merge,
          source health and toggles, failed-job details, or audit-log browsing yet.
        </p>
      </section>

      {reviewAction && (
        <ConfirmationDialog
          title={reviewAction.decision === 'APPROVE' ? 'Approve this title?' : 'Reject this title?'}
          description={
            reviewAction.decision === 'APPROVE'
              ? `${reviewAction.item.title} will become available in the catalogue.`
              : `${reviewAction.item.title} will be marked rejected and hidden from the active catalogue.`
          }
          confirmLabel={reviewAction.decision === 'APPROVE' ? 'Approve title' : 'Reject title'}
          busy={saving}
          onCancel={() => setReviewAction(null)}
          onConfirm={() => void submitReviewDecision()}
        />
      )}
    </div>
  );
}
