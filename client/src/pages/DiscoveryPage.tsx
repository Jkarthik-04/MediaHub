import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/PageStates';
import {
  addLibraryEntry,
  getLibrary,
  searchMedia,
  type LibraryStatus,
  type MediaCatalogueItem,
  type MediaTypeCode,
} from '../services/mediahub-api';

const PAGE_SIZE = 12;

export function DiscoveryPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'' | MediaTypeCode>('');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus>('PLANNED');

  const [results, setResults] = useState<MediaCatalogueItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const [libraryMediaIds, setLibraryMediaIds] = useState<Set<string>>(() => new Set<string>());
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryCheckError, setLibraryCheckError] = useState('');

  const [searchVersion, setSearchVersion] = useState(0);

  // Load existing entries from both Reading and Watching.
  useEffect(() => {
    let cancelled = false;

    async function loadLibraryIds() {
      setLibraryLoading(true);
      setLibraryCheckError('');

      try {
        const firstPage = await getLibrary({
          page: 1,
          limit: 100,
          sort: 'updatedAt:desc',
        });

        const entries = [...firstPage.data];

        for (let currentPage = 2; currentPage <= firstPage.meta.totalPages; currentPage += 1) {
          const response = await getLibrary({
            page: currentPage,
            limit: 100,
            sort: 'updatedAt:desc',
          });

          entries.push(...response.data);
        }

        if (!cancelled) {
          setLibraryMediaIds(new Set(entries.map((entry) => entry.mediaItem.id)));
        }
      } catch {
        if (!cancelled) {
          setLibraryCheckError(
            'Could not check your existing library. The server will still prevent duplicate entries.',
          );
        }
      } finally {
        if (!cancelled) {
          setLibraryLoading(false);
        }
      }
    }

    void loadLibraryIds();

    return () => {
      cancelled = true;
    };
  }, []);

  // Search the catalogue using the selected media type.
  useEffect(() => {
    if (!submittedQuery) {
      setResults([]);
      setTotalPages(1);
      setTotalItems(0);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadResults() {
      setLoading(true);
      setError('');
      setActionError('');
      setMessage('');

      try {
        const response = await searchMedia({
          q: submittedQuery,
          ...(selectedType ? { type: selectedType } : {}),
          page,
          limit: PAGE_SIZE,
          sort: 'title:asc',
        });

        if (!cancelled) {
          setResults(response.data);
          setTotalPages(Math.max(1, response.meta.totalPages));
          setTotalItems(response.meta.totalItems);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setResults([]);
          setTotalPages(1);
          setTotalItems(0);
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to search the media catalogue.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      cancelled = true;
    };
  }, [submittedQuery, selectedType, page, searchVersion]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError('Enter a title to search.');
      setResults([]);
      setSubmittedQuery('');
      return;
    }

    setPage(1);
    setSubmittedQuery(trimmedQuery);
    setSearchVersion((version) => version + 1);
  }

  // Add a title and prevent duplicate library entries.
  async function handleAdd(item: MediaCatalogueItem) {
    if (libraryMediaIds.has(item.id)) {
      setActionError('');
      setMessage(`${item.title} is already in your library.`);
      return;
    }

    setAddingId(item.id);
    setActionError('');
    setMessage('');

    try {
      await addLibraryEntry(item.id, libraryStatus);

      setLibraryMediaIds((current) => {
        const next = new Set(current);
        next.add(item.id);
        return next;
      });

      setMessage(
        `${item.title} was added to your library with status ${libraryStatus.replaceAll('_', ' ')}.`,
      );
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to add this title to your library.';

      if (errorMessage.toLowerCase().includes('already in your library')) {
        setLibraryMediaIds((current) => {
          const next = new Set(current);
          next.add(item.id);
          return next;
        });

        setActionError('');
        setMessage(`${item.title} is already in your library.`);
      } else {
        setActionError(errorMessage);
      }
    } finally {
      setAddingId(null);
    }
  }

  function changeType(value: '' | MediaTypeCode) {
    setSelectedType(value);
    setPage(1);
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Find something new" title="Discovery and import">
        Search the existing catalogue, inspect titles, and add movies, TV shows, anime, books, or
        manga to your personal library.
      </PageHeader>

      <section className="surface">
        <form onSubmit={handleSearch}>
          <label htmlFor="discovery-query">Search titles</label>

          <div className="control-row">
            <input
              id="discovery-query"
              type="search"
              maxLength={300}
              placeholder="Enter a title"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <button className="button button-primary" type="submit" disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          <div className="filter-grid" style={{ marginTop: '16px' }}>
            <label>
              Media type
              <select
                aria-label="Filter by media type"
                value={selectedType}
                onChange={(event) => changeType(event.target.value as '' | MediaTypeCode)}
              >
                <option value="">All media types</option>
                <option value="MOVIE">Movies</option>
                <option value="TV">TV Shows</option>
                <option value="ANIME">Anime</option>
                <option value="BOOK">Books</option>
                <option value="MANGA">Manga</option>
              </select>
            </label>

            <label>
              Default library status
              <select
                aria-label="Default status for added titles"
                value={libraryStatus}
                onChange={(event) => setLibraryStatus(event.target.value as LibraryStatus)}
              >
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="DROPPED">Dropped</option>
              </select>
            </label>
          </div>
        </form>
      </section>

      {libraryCheckError && (
        <div className="surface" role="status">
          {libraryCheckError}
        </div>
      )}

      {error && (
        <section className="surface" role="alert">
          <h2>Search failed</h2>
          <p>{error}</p>
          <button
            className="tab"
            type="button"
            onClick={() => setSearchVersion((version) => version + 1)}
            disabled={!submittedQuery || loading}
          >
            Try again
          </button>
        </section>
      )}

      {actionError && (
        <div className="surface" role="alert">
          {actionError}
        </div>
      )}

      {message && (
        <div className="surface" role="status">
          {message}
        </div>
      )}

      {loading ? (
        <div className="surface" role="status">
          Searching the catalogue…
        </div>
      ) : submittedQuery && !error && results.length === 0 ? (
        <EmptyState title="No matching titles found">
          Try another search term or change the media type filter.
        </EmptyState>
      ) : results.length > 0 ? (
        <>
          <section className="page-stack" aria-label="Search results">
            <p>
              Found {totalItems} matching title
              {totalItems === 1 ? '' : 's'}.
            </p>

            {results.map((item) => {
              const alreadyInLibrary = libraryMediaIds.has(item.id);

              return (
                <article className="surface" key={item.id}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={`Cover of ${item.title}`}
                        loading="lazy"
                        style={{
                          width: '100px',
                          height: '140px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                        }}
                      />
                    ) : (
                      <div
                        aria-label="No cover available"
                        style={{
                          width: '100px',
                          height: '140px',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '8px',
                          background: 'var(--color-surface-secondary, #eee)',
                        }}
                      >
                        No cover
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <h2>{item.title}</h2>

                      <p>
                        {item.mediaType.name}
                        {item.releaseDate ? ` · ${item.releaseDate.slice(0, 10)}` : ''}
                      </p>

                      {item.description && <p>{item.description}</p>}

                      <p>
                        Genres:{' '}
                        {item.genres.map((genre) => genre.name).join(', ') || 'Not specified'}
                      </p>

                      <p>Total units: {item.totalUnits ?? 'Unknown'}</p>

                      <button
                        className="button button-primary"
                        type="button"
                        disabled={libraryLoading || addingId === item.id || alreadyInLibrary}
                        onClick={() => void handleAdd(item)}
                      >
                        {libraryLoading
                          ? 'Checking library…'
                          : addingId === item.id
                            ? 'Adding…'
                            : alreadyInLibrary
                              ? 'Already in Library'
                              : 'Add to Library'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="surface">
            <p>
              Page {page} of {totalPages}
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="tab"
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>

              <button
                className="tab"
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      ) : (
        <EmptyState title="Search the catalogue">
          Enter a title above to find movies, TV shows, anime, books, or manga to add to your
          library.
        </EmptyState>
      )}
    </div>
  );
}
