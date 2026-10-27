import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState, ErrorState, LoadingState } from '../components/PageStates';
import { PageHeader } from '../components/PageHeader';
import {
  addLibraryEntry,
  getLibrary,
  getMediaDetails,
  type LibraryEntry,
  type LibraryStatus,
  type MediaDetails,
} from '../services/mediahub-api';

const statuses: LibraryStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'DROPPED'];

export function MediaDetailsPage() {
  const { mediaId } = useParams();
  const [media, setMedia] = useState<MediaDetails | null>(null);
  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [status, setStatus] = useState<LibraryStatus>('PLANNED');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!mediaId) {
        setError('This media link is missing an ID.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const response = await getMediaDetails(mediaId);
        const mediaItem = response.data;
        const libraryResponse = await getLibrary({
          q: mediaItem.title,
          type: mediaItem.mediaType.code,
          page: 1,
          limit: 100,
        });
        if (cancelled) return;
        setMedia(mediaItem);
        setEntry(libraryResponse.data.find((item) => item.mediaItem.id === mediaItem.id) ?? null);
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error ? caughtError.message : 'Unable to load this title.',
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
  }, [mediaId]);

  async function addToLibrary() {
    if (!media) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await addLibraryEntry(media.id, status);
      setEntry(response.data);
      setMessage(
        `${media.title} was added to your ${media.mediaType.section.toLowerCase()} library.`,
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to add this title.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading media details…" />;
  if (error && !media) {
    return <ErrorState title="Unable to load this title">{error}</ErrorState>;
  }
  if (!media)
    return <EmptyState title="Title not found">This catalogue record is unavailable.</EmptyState>;

  const unitsBySeason = new Map<number | null, typeof media.units>();
  for (const unit of media.units) {
    const current = unitsBySeason.get(unit.seasonNumber) ?? [];
    current.push(unit);
    unitsBySeason.set(unit.seasonNumber, current);
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Catalogue item" title={media.title}>
        {media.mediaType.name} · {media.mediaType.section === 'READING' ? 'Reading' : 'Watching'}
      </PageHeader>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}

      <section className="surface details-layout">
        {media.coverUrl ? (
          <img className="details-cover" src={media.coverUrl} alt={`Cover of ${media.title}`} />
        ) : (
          <div className="details-cover cover-placeholder">No cover available</div>
        )}
        <div className="details-copy">
          <h2>About this title</h2>
          <p>{media.description || 'No description is available.'}</p>
          <dl className="details-list">
            <div>
              <dt>Media type</dt>
              <dd>{media.mediaType.name}</dd>
            </div>
            <div>
              <dt>Release</dt>
              <dd>
                {media.releaseDate
                  ? new Date(media.releaseDate).toLocaleDateString()
                  : 'Not provided'}
              </dd>
            </div>
            <div>
              <dt>Genres</dt>
              <dd>{media.genres.map((genre) => genre.name).join(', ') || 'Not specified'}</dd>
            </div>
            <div>
              <dt>Total units</dt>
              <dd>
                {media.totalUnits ?? 'Not provided'}
                {media.totalUnits !== null
                  ? ` (${media.mediaType.progressMode.toLowerCase()} units)`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Catalogue status</dt>
              <dd>{media.reviewStatus.replaceAll('_', ' ').toLowerCase()}</dd>
            </div>
          </dl>
          <h3>Sources</h3>
          {media.sources.length ? (
            <ul>
              {media.sources.map((source) => (
                <li key={`${source.key}:${source.externalId}`}>
                  <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                    {source.name}
                  </a>
                  {' · '}
                  {source.externalId}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No external provider mapping is recorded.</p>
          )}
        </div>
      </section>

      <section className="surface">
        <h2>Your library entry</h2>
        {entry ? (
          <div className="details-library-entry">
            <p>
              <strong>Status:</strong> {entry.status.replaceAll('_', ' ')}
            </p>
            <p>
              <strong>Progress:</strong> {entry.progressValue ?? 0} /{' '}
              {media.totalUnits ?? 'unknown'} {media.mediaType.progressMode.toLowerCase()}
            </p>
            <p>
              <strong>Rating:</strong> {entry.rating ?? 'Not rated'}
            </p>
            <p>
              <strong>Started:</strong>{' '}
              {entry.startedAt ? new Date(entry.startedAt).toLocaleDateString() : 'Not started'}
            </p>
            <p>
              <strong>Completed:</strong>{' '}
              {entry.completedAt
                ? new Date(entry.completedAt).toLocaleDateString()
                : 'Not completed'}
            </p>
            <Link to={media.mediaType.section === 'READING' ? '/reading' : '/watching'}>
              Open {media.mediaType.section.toLowerCase()} library
            </Link>
          </div>
        ) : (
          <div className="control-row details-add-row">
            <label htmlFor="details-library-status">
              Add to {media.mediaType.section.toLowerCase()}
            </label>
            <select
              id="details-library-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as LibraryStatus)}
            >
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
            <button
              className="button button-primary"
              type="button"
              disabled={saving}
              onClick={() => void addToLibrary()}
            >
              {saving ? 'Adding…' : 'Add to library'}
            </button>
          </div>
        )}
      </section>

      <section className="surface">
        <h2>Units</h2>
        {media.units.length === 0 ? (
          <p className="muted">No episode, chapter, or other unit metadata is available.</p>
        ) : (
          [...unitsBySeason.entries()].map(([season, units]) => (
            <div key={season ?? 'unseasoned'}>
              <h3>{season === null ? 'Units' : `Season ${season}`}</h3>
              <ul className="data-list">
                {units.map((unit) => (
                  <li key={unit.id}>
                    <span>{unit.title || `${unit.unitKind} ${unit.sequenceNumber ?? ''}`}</span>
                    <span>
                      {unit.pageCount
                        ? `${unit.pageCount} pages`
                        : unit.durationMinutes
                          ? `${unit.durationMinutes} min`
                          : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="surface">
        <h2>Related titles</h2>
        <p className="muted">
          Related and adaptation links are not represented in the current MediaHub API.
        </p>
      </section>
    </div>
  );
}
