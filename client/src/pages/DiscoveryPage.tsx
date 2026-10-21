import { useEffect, useState, type FormEvent } from 'react';

import { EmptyState } from '../components/PageStates';
import { PageHeader } from '../components/PageHeader';
import {
  confirmImport,
  previewImport,
  searchDiscovery,
  type DiscoveryMedia,
  type LibraryStatus,
} from '../services/mediahub-api';

const PAGE_SIZE = 12;

export function DiscoveryPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'BOOK' | 'MANGA'>('BOOK');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus>('PLANNED');
  const [results, setResults] = useState<DiscoveryMedia[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (!submittedQuery) return;

    let cancelled = false;
    async function loadResults() {
      setLoading(true);
      setError('');
      setMessage('');
      try {
        const response = await searchDiscovery({
          q: submittedQuery,
          type: selectedType,
          page,
          limit: PAGE_SIZE,
        });
        if (!cancelled) {
          setResults(response.data);
          setTotalPages(Math.max(1, response.meta.totalPages));
          setTotalItems(response.meta.totalItems);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setResults([]);
          setTotalItems(0);
          setTotalPages(1);
          setError(
            caughtError instanceof Error ? caughtError.message : 'Unable to search providers.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadResults();
    return () => {
      cancelled = true;
    };
  }, [submittedQuery, selectedType, page]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Enter a title to search.');
      return;
    }
    setPage(1);
    setSubmittedQuery(trimmedQuery);
  }

  async function handleImport(item: DiscoveryMedia) {
    setImportingId(item.externalId);
    setError('');
    setMessage('');
    try {
      const preview = await previewImport(item, libraryStatus);
      const candidate = preview.data.candidates[0];
      if (!candidate) throw new Error('The import preview did not contain a title.');

      const existingMatch = candidate.proposedAction !== 'CREATE' ? candidate.match : null;
      await confirmImport(preview.data.id, {
        candidateId: candidate.id,
        action: existingMatch ? 'REUSE' : 'CREATE',
        ...(existingMatch ? { mediaItemId: existingMatch.id } : {}),
      });
      setMessage(
        existingMatch
          ? `${item.title} was added using the existing MediaHub title.`
          : `${item.title} was imported and added to your library.`,
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to import this title.');
    } finally {
      setImportingId(null);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Find something new" title="Discovery and import">
        Search Open Library for books or Jikan for manga, then add a title to your library.
      </PageHeader>

      <section className="surface">
        <form onSubmit={handleSearch}>
          <label htmlFor="discovery-query">Search titles</label>
          <div className="control-row">
            <input
              id="discovery-query"
              type="search"
              maxLength={200}
              placeholder="Enter a book or manga title"
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
                aria-label="Media type"
                value={selectedType}
                onChange={(event) => {
                  setSelectedType(event.target.value as 'BOOK' | 'MANGA');
                  setPage(1);
                }}
              >
                <option value="BOOK">Books</option>
                <option value="MANGA">Manga</option>
              </select>
            </label>

            <label>
              Default library status
              <select
                aria-label="Default status for imported titles"
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
          Searching the provider…
        </div>
      ) : submittedQuery && results.length === 0 && !error ? (
        <EmptyState title="No matching titles found">Try another title or search term.</EmptyState>
      ) : results.length > 0 ? (
        <>
          <section className="page-stack" aria-label="Search results">
            <p>
              Found {totalItems} matching title{totalItems === 1 ? '' : 's'}.
            </p>
            {results.map((item) => (
              <article className="surface" key={`${item.provider}:${item.externalId}`}>
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
                      {item.mediaType}
                      {item.releaseDate ? ` · ${item.releaseDate.slice(0, 10)}` : ''}
                    </p>
                    {item.description && <p>{item.description}</p>}
                    <p>Genres: {item.genres.join(', ') || 'Not specified'}</p>
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={importingId === item.externalId}
                      onClick={() => void handleImport(item)}
                    >
                      {importingId === item.externalId ? 'Importing…' : 'Import to Library'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
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
        <EmptyState title="Search external catalogues">
          Enter a book or manga title to discover and import it.
        </EmptyState>
      )}
    </div>
  );
}
