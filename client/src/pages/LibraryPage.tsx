
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/PageStates';
import {
  deleteLibraryEntry,
  getLibrary,
  updateLibraryEntry,
  updateLibraryProgress,
  type LibraryEntry,
  type LibrarySection,
  type LibrarySort,
  type LibraryStatus,
  type MediaTypeCode,
} from '../services/mediahub-api';

const PAGE_SIZE = 20;

const statuses: LibraryStatus[] = [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'DROPPED',
];

function getProgressUnit(entry: LibraryEntry): string {
  switch (entry.mediaItem.mediaType.progressMode) {
    case 'PERCENTAGE':
      return '%';
    case 'PAGE':
      return 'pages';
    case 'CHAPTER':
      return 'chapters';
    case 'VOLUME':
      return 'volumes';
    case 'EPISODE':
      return 'episodes';
    default:
      return 'units';
  }
}

function getMediaTypeCode(tab: string): MediaTypeCode | undefined {
  switch (tab.trim().toLowerCase()) {
    case 'book':
    case 'books':
      return 'BOOK';
    case 'manga':
      return 'MANGA';
    case 'movie':
    case 'movies':
      return 'MOVIE';
    case 'tv':
    case 'tv show':
    case 'tv shows':
      return 'TV';
    case 'anime':
      return 'ANIME';
    default:
      return undefined;
  }
}

export function LibraryPage({
  title,
  description,
  tabs,
}: {
  title: string;
  description: string;
  tabs: string[];
}) {
  const section: LibrarySection =
    title.toLowerCase() === 'reading' ? 'READING' : 'WATCHING';

  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [activeTab, setActiveTab] = useState(tabs[0] ?? '');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LibraryStatus | ''>('');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState<LibrarySort>('updatedAt:desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Reading progress state
  const [progressDrafts, setProgressDrafts] = useState<
    Record<string, string>
  >({});
  const [savingProgressId, setSavingProgressId] = useState<string | null>(
    null,
  );
  const [progressError, setProgressError] = useState('');
  const [progressMessage, setProgressMessage] = useState('');

  // Edit and remove state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<LibraryStatus>('PLANNED');
  const [editRating, setEditRating] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [entryActionError, setEntryActionError] = useState('');
  const [entryActionMessage, setEntryActionMessage] = useState('');

  // Fetch results from the backend with search, media type and filters.
  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      setLoading(true);
      setError('');

      try {
        const response = await getLibrary({
          section,
          type: getMediaTypeCode(activeTab),
          q: search.trim() || undefined,
          status: status || undefined,
          genre: genre.trim() || undefined,
          sort,
          page,
          limit: PAGE_SIZE,
        });

        if (!cancelled) {
          setEntries(response.data);

          setProgressDrafts((current) => ({
            ...current,
            ...Object.fromEntries(
              response.data.map((entry) => [
                entry.id,
                String(entry.progressValue ?? 0),
              ]),
            ),
          }));

          setTotalPages(Math.max(1, response.meta.totalPages));
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Could not load your library.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLibrary();

    return () => {
      cancelled = true;
    };
  }, [
    section,
    activeTab,
    search,
    status,
    genre,
    sort,
    page,
    retryCount,
  ]);

  // Save reading progress.
  async function saveProgress(entry: LibraryEntry) {
    const rawValue =
      progressDrafts[entry.id] ?? String(entry.progressValue ?? 0);
    const value = Number(rawValue);

    if (rawValue.trim() === '' || !Number.isFinite(value) || value < 0) {
      setProgressError('Enter a valid, non-negative progress value.');
      setProgressMessage('');
      return;
    }

    const maximum =
      entry.mediaItem.mediaType.progressMode === 'PERCENTAGE'
        ? 100
        : entry.mediaItem.totalUnits;

    if (maximum !== null && maximum !== undefined && value > maximum) {
      setProgressError(`Progress cannot be greater than ${maximum}.`);
      setProgressMessage('');
      return;
    }

    setSavingProgressId(entry.id);
    setProgressError('');
    setProgressMessage('');
    setEntryActionError('');

    try {
      await updateLibraryProgress(entry.id, { progressValue: value });

      setProgressMessage(`Progress saved for ${entry.mediaItem.title}.`);
      setRetryCount((count) => count + 1);
    } catch (caughtError) {
      setProgressError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to save reading progress.',
      );
    } finally {
      setSavingProgressId(null);
    }
  }

  // Populate the edit form.
  function beginEditing(entry: LibraryEntry) {
    setEditingEntryId(entry.id);
    setEditStatus(entry.status);
    setEditRating(entry.rating === null ? '' : String(entry.rating));
    setEditNotes(entry.notes ?? '');
    setEntryActionError('');
    setEntryActionMessage('');
  }

  // Save status, rating and notes.
  async function saveEntryChanges(entry: LibraryEntry) {
    const rating = editRating.trim() === '' ? null : Number(editRating);

    if (
      rating !== null &&
      (!Number.isFinite(rating) ||
        rating < 0 ||
        rating > 10 ||
        !Number.isInteger(rating * 2))
    ) {
      setEntryActionError(
        'Rating must be between 0 and 10 in increments of 0.5.',
      );
      setEntryActionMessage('');
      return;
    }

    if (editNotes.length > 5000) {
      setEntryActionError('Notes cannot exceed 5000 characters.');
      setEntryActionMessage('');
      return;
    }

    setSavingEntryId(entry.id);
    setEntryActionError('');
    setEntryActionMessage('');

    try {
      await updateLibraryEntry(entry.id, {
        status: editStatus,
        rating,
        notes: editNotes.trim() || null,
      });

      setEditingEntryId(null);
      setEntryActionMessage(`Updated ${entry.mediaItem.title}.`);
      setRetryCount((count) => count + 1);
    } catch (caughtError) {
      setEntryActionError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to update this entry.',
      );
    } finally {
      setSavingEntryId(null);
    }
  }

  // Remove an entry after confirmation.
  async function removeEntry(entry: LibraryEntry) {
    const confirmed = window.confirm(
      `Remove "${entry.mediaItem.title}" from your library?`,
    );

    if (!confirmed) return;

    setSavingEntryId(entry.id);
    setEntryActionError('');
    setEntryActionMessage('');

    try {
      await deleteLibraryEntry(entry.id);

      setEditingEntryId(null);
      setPage(1);
      setEntryActionMessage(`${entry.mediaItem.title} was removed.`);
      setRetryCount((count) => count + 1);
    } catch (caughtError) {
      setEntryActionError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to remove this entry.',
      );
    } finally {
      setSavingEntryId(null);
    }
  }

  function changeStatus(value: string) {
    setStatus(value as LibraryStatus | '');
    setPage(1);
  }

  function changeSort(value: string) {
    setSort(value as LibrarySort);
    setPage(1);
  }

  function changeTab(tab: string) {
    setActiveTab(tab);
    setPage(1);
    setSearch('');
  }

  const hasActiveFilters =
    search.trim() !== '' || status !== '' || genre.trim() !== '';

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Personal library" title={title}>
        {description}
      </PageHeader>

      <section className="surface">
        <div
          className="tab-list"
          role="tablist"
          aria-label={`${title} media types`}
        >
          {tabs.map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className="tab"
              key={tab}
              onClick={() => changeTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="filter-grid">
          <input
            aria-label="Search library"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search all library titles"
            type="search"
            value={search}
          />

          <select
            aria-label="Filter by status"
            onChange={(event) => changeStatus(event.target.value)}
            value={status}
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll('_', ' ')}
              </option>
            ))}
          </select>

          <input
            aria-label="Filter by genre"
            onChange={(event) => {
              setGenre(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by genre"
            value={genre}
          />

          <select
            aria-label="Sort library"
            onChange={(event) => changeSort(event.target.value)}
            value={sort}
          >
            <option value="updatedAt:desc">Recently updated</option>
            <option value="title:asc">Title A–Z</option>
            <option value="rating:desc">Highest rating</option>
          </select>
        </div>
      </section>

      {progressError && (
        <div className="surface" role="alert">
          {progressError}
        </div>
      )}

      {progressMessage && (
        <div className="surface" role="status">
          {progressMessage}
        </div>
      )}

      {entryActionError && (
        <div className="surface" role="alert">
          {entryActionError}
        </div>
      )}

      {entryActionMessage && (
        <div className="surface" role="status">
          {entryActionMessage}
        </div>
      )}

      {loading ? (
        <div className="surface" role="status">
          Loading your library…
        </div>
      ) : error ? (
        <section className="surface" role="alert">
          <h2>Unable to load your library</h2>
          <p>{error}</p>
          <button
            className="tab"
            onClick={() => setRetryCount((count) => count + 1)}
            type="button"
          >
            Try again
          </button>
        </section>
      ) : entries.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters
              ? 'No matching titles'
              : `No ${activeTab.toLowerCase()} entries to show`
          }
        >
          {hasActiveFilters
            ? 'Try another search or change your filters.'
            : 'Your library is empty for this media type.'}
        </EmptyState>
      ) : (
        <>
          <div className="page-stack">
            {entries.map((entry) => {
              const unit = getProgressUnit(entry);
              const maximum =
                entry.mediaItem.mediaType.progressMode === 'PERCENTAGE'
                  ? 100
                  : entry.mediaItem.totalUnits ?? undefined;

              return (
                <article className="surface" key={entry.id}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    {entry.mediaItem.coverUrl && (
                      <img
                        alt={`Cover of ${entry.mediaItem.title}`}
                        src={entry.mediaItem.coverUrl}
                        loading="lazy"
                        style={{
                          width: '90px',
                          height: '125px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                        }}
                      />
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2>{entry.mediaItem.title}</h2>

                      <p>
                        {entry.mediaItem.mediaType.name} ·{' '}
                        {entry.status.replaceAll('_', ' ')}
                      </p>

                      <p>
                        Genres:{' '}
                        {entry.mediaItem.genres
                          .map((item) => item.name)
                          .join(', ') || 'Not specified'}
                      </p>

                      <p>
                        Progress: {entry.progressValue ?? 0}
                        {unit === '%' ? '%' : ` ${unit}`} /{' '}
                        {entry.mediaItem.totalUnits ?? 'Unknown total'}
                        {entry.mediaItem.totalUnits !== null && unit !== '%'
                          ? ` ${unit}`
                          : ''}
                      </p>

                      {entry.currentUnit && (
                        <p>
                          Current unit:{' '}
                          {entry.currentUnit.title ??
                            entry.currentUnit.sequenceNumber ??
                            'Untitled'}
                        </p>
                      )}

                      <p>Rating: {entry.rating ?? 'Not rated'}</p>

                      {section === 'READING' && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            alignItems: 'center',
                            marginTop: '16px',
                          }}
                        >
                          <label htmlFor={`progress-${entry.id}`}>
                            Update progress ({unit})
                          </label>

                          <input
                            id={`progress-${entry.id}`}
                            aria-label={`New progress for ${entry.mediaItem.title}`}
                            type="number"
                            min={0}
                            max={maximum}
                            step="any"
                            value={
                              progressDrafts[entry.id] ??
                              String(entry.progressValue ?? 0)
                            }
                            onChange={(event) =>
                              setProgressDrafts((current) => ({
                                ...current,
                                [entry.id]: event.target.value,
                              }))
                            }
                          />

                          <button
                            className="tab"
                            disabled={
                              savingProgressId === entry.id ||
                              savingEntryId === entry.id
                            }
                            onClick={() => void saveProgress(entry)}
                            type="button"
                          >
                            {savingProgressId === entry.id
                              ? 'Saving…'
                              : 'Save Progress'}
                          </button>
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          marginTop: '16px',
                        }}
                      >
                        {editingEntryId === entry.id ? (
                          <div
                            style={{
                              display: 'grid',
                              gap: '10px',
                              width: '100%',
                              maxWidth: '480px',
                            }}
                          >
                            <label htmlFor={`edit-status-${entry.id}`}>
                              Status
                            </label>

                            <select
                              id={`edit-status-${entry.id}`}
                              value={editStatus}
                              onChange={(event) =>
                                setEditStatus(
                                  event.target.value as LibraryStatus,
                                )
                              }
                            >
                              {statuses.map((item) => (
                                <option key={item} value={item}>
                                  {item.replaceAll('_', ' ')}
                                </option>
                              ))}
                            </select>

                            <label htmlFor={`edit-rating-${entry.id}`}>
                              Rating (0–10)
                            </label>

                            <input
                              id={`edit-rating-${entry.id}`}
                              type="number"
                              min={0}
                              max={10}
                              step={0.5}
                              value={editRating}
                              onChange={(event) =>
                                setEditRating(event.target.value)
                              }
                              placeholder="Enter rating"
                            />

                            <label htmlFor={`edit-notes-${entry.id}`}>
                              Notes
                            </label>

                            <textarea
                              id={`edit-notes-${entry.id}`}
                              rows={3}
                              maxLength={5000}
                              value={editNotes}
                              onChange={(event) =>
                                setEditNotes(event.target.value)
                              }
                              placeholder="Optional notes"
                            />

                            <div
                              style={{
                                display: 'flex',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <button
                                className="tab"
                                type="button"
                                disabled={savingEntryId === entry.id}
                                onClick={() =>
                                  void saveEntryChanges(entry)
                                }
                              >
                                {savingEntryId === entry.id
                                  ? 'Saving…'
                                  : 'Save changes'}
                              </button>

                              <button
                                className="tab"
                                type="button"
                                disabled={savingEntryId === entry.id}
                                onClick={() => setEditingEntryId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              className="tab"
                              type="button"
                              disabled={
                                savingEntryId === entry.id ||
                                savingProgressId === entry.id
                              }
                              onClick={() => beginEditing(entry)}
                            >
                              Edit
                            </button>

                            <button
                              className="tab"
                              type="button"
                              disabled={
                                savingEntryId === entry.id ||
                                savingProgressId === entry.id
                              }
                              onClick={() => void removeEntry(entry)}
                            >
                              {savingEntryId === entry.id
                                ? 'Removing…'
                                : 'Remove'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="surface">
            <p>
              Page {page} of {totalPages}
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="tab"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                Previous
              </button>

              <button
                className="tab"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
