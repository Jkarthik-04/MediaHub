import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  addLibraryEntry,
  getRecommendations,
  refreshRecommendations,
  sendRecommendationFeedback,
  type Recommendation,
  type RecommendationFeedback,
} from '../services/mediahub-api';

type Props = {
  libraryMediaIds: Set<string>;
  libraryLoading: boolean;
  onLibraryChanged: () => void;
};

export function RecommendationSection({
  libraryMediaIds,
  libraryLoading,
  onLibraryChanged,
}: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const current = await getRecommendations();
        const response = current.data.length > 0 ? current : await refreshRecommendations();
        if (!cancelled) setRecommendations(response.data);
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error ? caughtError.message : 'Could not load recommendations.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function regenerate() {
    setRefreshing(true);
    setError('');
    setMessage('');
    try {
      const response = await refreshRecommendations();
      setRecommendations(response.data);
      setMessage('Recommendations refreshed from your current library.');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Could not refresh recommendations.',
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function addRecommendedTitle(recommendation: Recommendation) {
    setBusyId(recommendation.id);
    setError('');
    setMessage('');
    try {
      await addLibraryEntry(recommendation.mediaItem.id);
      await sendRecommendationFeedback(recommendation.id, 'USEFUL');
      setRecommendations((current) => current.filter((item) => item.id !== recommendation.id));
      setMessage(`${recommendation.mediaItem.title} was added to your library.`);
      onLibraryChanged();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not add this title.');
    } finally {
      setBusyId(null);
    }
  }

  async function giveFeedback(id: string, feedback: RecommendationFeedback) {
    setBusyId(id);
    setError('');
    try {
      await sendRecommendationFeedback(id, feedback);
      setRecommendations((current) => current.filter((item) => item.id !== id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save feedback.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="surface recommendation-section" aria-labelledby="recommendation-heading">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Your combined taste</p>
          <h2 id="recommendation-heading">Recommended for you</h2>
          <p className="muted">
            Explainable matches based on genres, ratings, and progress across your reading and
            watching libraries.
          </p>
        </div>
        <button
          className="tab"
          type="button"
          disabled={loading || refreshing}
          onClick={() => void regenerate()}
        >
          {refreshing ? 'Refreshing…' : 'Refresh matches'}
        </button>
      </div>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Finding matches from your library…</p>
      ) : recommendations.length === 0 ? (
        <div className="recommendation-empty">
          <h3>No matches yet</h3>
          <p className="muted">
            Add or rate a few titles with genres, then refresh. MediaHub only recommends catalogue
            titles that are not already in your library.
          </p>
        </div>
      ) : (
        <div className="recommendation-grid">
          {recommendations.map((recommendation) => {
            const item = recommendation.mediaItem;
            const alreadyAdded = libraryMediaIds.has(item.id);
            return (
              <article className="recommendation-card" key={recommendation.id}>
                <Link to={`/media/${item.id}`} className="recommendation-cover-link">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt={`Cover of ${item.title}`} loading="lazy" />
                  ) : (
                    <span className="cover-placeholder">No cover</span>
                  )}
                </Link>
                <div className="recommendation-copy">
                  <div className="recommendation-score">
                    {Math.round(recommendation.score * 100)}% match
                  </div>
                  <h3>
                    <Link to={`/media/${item.id}`}>{item.title}</Link>
                  </h3>
                  <p className="muted">{item.mediaType.name}</p>
                  <p>{recommendation.reason}</p>
                  <p className="recommendation-genres">
                    {item.genres.map((genre) => genre.name).join(' · ')}
                  </p>
                  <div className="inline-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={libraryLoading || alreadyAdded || busyId === recommendation.id}
                      onClick={() => void addRecommendedTitle(recommendation)}
                    >
                      {busyId === recommendation.id
                        ? 'Saving…'
                        : alreadyAdded
                          ? 'In library'
                          : 'Add to library'}
                    </button>
                    <button
                      className="tab"
                      type="button"
                      disabled={busyId === recommendation.id}
                      onClick={() => void giveFeedback(recommendation.id, 'NOT_INTERESTED')}
                    >
                      Not interested
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
