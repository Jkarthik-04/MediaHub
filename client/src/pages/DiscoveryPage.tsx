import { useEffect, useState, type FormEvent } from 'react';

import { EmptyState } from '../components/PageStates';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { RecommendationSection } from '../components/RecommendationSection';
import { ApiError } from '../services/api-client';
import { isCatalogueItemInLibrary, isProviderItemInLibrary } from '../utils/discovery-duplicates';
import {
  addLibraryEntry,
  confirmImport,
  getLibrary,
  previewImport,
  searchDiscovery,
  searchMedia,
  submitManualMedia,
  type DiscoveryMedia,
  type ImportJob,
  type LibraryEntry,
  type LibraryStatus,
  type MediaCatalogueItem,
  type MediaTypeCode,
} from '../services/mediahub-api';

const PAGE_SIZE = 12;
type DiscoveryResult =
  | { kind: 'catalogue'; item: MediaCatalogueItem }
  | { kind: 'provider'; item: DiscoveryMedia };

export function DiscoveryPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MediaTypeCode>('BOOK');
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus>('PLANNED');
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [libraryMediaIds, setLibraryMediaIds] = useState<Set<string>>(() => new Set());
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryCheckError, setLibraryCheckError] = useState('');
  const [searchVersion, setSearchVersion] = useState(0);
  const [externalSearchAttempted, setExternalSearchAttempted] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [manualGenres, setManualGenres] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    jobId: string;
    item: DiscoveryMedia;
    candidate: ImportJob['candidates'][number];
  } | null>(null);

  // Check both Reading and Watching so titles cannot be added twice through Discovery.
  useEffect(() => {
    let cancelled = false;

    async function loadLibraryIds() {
      setLibraryLoading(true);
      setLibraryCheckError('');
      try {
        const firstPage = await getLibrary({ page: 1, limit: 100, sort: 'updatedAt:desc' });
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
          setLibraryEntries(entries);
        }
      } catch {
        if (!cancelled) {
          setLibraryCheckError(
            'Could not check your existing library. The server will still prevent duplicate entries.',
          );
        }
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    }

    void loadLibraryIds();
    return () => {
      cancelled = true;
    };
  }, [searchVersion]);

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
      setExternalSearchAttempted(false);
      setManualSubmitted(false);
      setPendingImport(null);
      try {
        if (selectedType === 'BOOK' || selectedType === 'MANGA') {
          setExternalSearchAttempted(true);
          const response = await searchDiscovery({
            q: submittedQuery,
            type: selectedType,
            page,
            limit: PAGE_SIZE,
          });
          if (!cancelled) {
            setResults(response.data.map((item) => ({ kind: 'provider', item })));
            setTotalPages(Math.max(1, response.meta.totalPages));
            setTotalItems(response.meta.totalItems);
          }
        } else {
          // The MediaHub catalogue supports MOVIE, TV, and ANIME records. TV has
          // no external provider in the backend, so these use internal IDs.
          const catalogueResponse = await searchMedia({
            q: submittedQuery,
            type: selectedType,
            page,
            limit: PAGE_SIZE,
            sort: 'title:asc',
          });
          if (
            !catalogueResponse.data.length &&
            (selectedType === 'MOVIE' || selectedType === 'ANIME')
          ) {
            setExternalSearchAttempted(true);
            const providerResponse = await searchDiscovery({
              q: submittedQuery,
              type: selectedType,
              page,
              limit: PAGE_SIZE,
            });
            if (!cancelled) {
              setResults(providerResponse.data.map((item) => ({ kind: 'provider', item })));
              setTotalPages(Math.max(1, providerResponse.meta.totalPages));
              setTotalItems(providerResponse.meta.totalItems);
            }
          } else if (!cancelled) {
            setResults(catalogueResponse.data.map((item) => ({ kind: 'catalogue', item })));
            setTotalPages(Math.max(1, catalogueResponse.meta.totalPages));
            setTotalItems(catalogueResponse.meta.totalItems);
          }
        }
      } catch (caughtError) {
        if (!cancelled) {
          setResults([]);
          setTotalPages(1);
          setTotalItems(0);
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to search titles.');
        }
      } finally {
        if (!cancelled) setLoading(false);
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
    if (trimmedQuery.length < 2) {
      setError('Enter at least two characters to search.');
      setResults([]);
      setSubmittedQuery('');
      return;
    }
    setPage(1);
    setSubmittedQuery(trimmedQuery);
    setSearchVersion((version) => version + 1);
  }

  async function handleAddCatalogueItem(item: MediaCatalogueItem) {
    if (libraryMediaIds.has(item.id)) {
      setActionError('');
      setMessage('This title already exists in your list.');
      return;
    }
    setBusyId(item.id);
    setActionError('');
    setMessage('');
    try {
      // item.id is the internal MediaHub media_items ID expected by this endpoint.
      await addLibraryEntry(item.id, libraryStatus);
      setLibraryMediaIds((current) => new Set(current).add(item.id));
      setMessage(
        `${item.title} was added to your library with status ${libraryStatus.replaceAll('_', ' ')}.`,
      );
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error ? caughtError.message : 'Unable to add title.';
      if (caughtError instanceof ApiError && caughtError.code === 'LIBRARY_ENTRY_EXISTS') {
        setLibraryMediaIds((current) => new Set(current).add(item.id));
        setMessage('This title already exists in your list.');
      } else {
        setActionError(errorMessage);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleImport(item: DiscoveryMedia) {
    setBusyId(item.externalId);
    setActionError('');
    setError('');
    setMessage('');
    try {
      const preview = await previewImport(item, libraryStatus);
      const candidate = preview.data.candidates[0];
      if (!candidate) throw new Error('The import preview did not contain a title.');
      setPendingImport({ jobId: preview.data.id, item, candidate });
      setMessage('Review the import match and choose how to continue.');
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === 'LIBRARY_ENTRY_EXISTS') {
        setPendingImport(null);
        setMessage('This title already exists in your list.');
        setSearchVersion((version) => version + 1);
      } else {
        setActionError(
          caughtError instanceof Error ? caughtError.message : 'Unable to import title.',
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  async function confirmPendingImport(action: 'CREATE' | 'REUSE' | 'SKIP') {
    if (!pendingImport) return;
    const { jobId, item, candidate } = pendingImport;
    const match = candidate.match;
    if (action === 'REUSE' && !match) {
      setActionError('There is no existing catalogue match to reuse.');
      return;
    }
    // candidate.match.id is the internal MediaHub ID; provider and candidate IDs are external/staging IDs.
    if (action === 'REUSE' && match && libraryMediaIds.has(match.id)) {
      setPendingImport(null);
      setMessage('This title already exists in your list.');
      return;
    }
    setBusyId(item.externalId);
    setActionError('');
    try {
      await confirmImport(jobId, {
        candidateId: candidate.id,
        action,
        ...(action === 'REUSE' && match ? { mediaItemId: match.id } : {}),
      });
      setPendingImport(null);
      setMessage(
        action === 'SKIP'
          ? `${item.title} was skipped.`
          : action === 'REUSE'
            ? `${item.title} was added using the existing MediaHub title.`
            : `${item.title} was imported and added to your library.`,
      );
      setSearchVersion((version) => version + 1);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === 'LIBRARY_ENTRY_EXISTS') {
        setPendingImport(null);
        setMessage('This title already exists in your list.');
        setSearchVersion((version) => version + 1);
      } else {
        setActionError(
          caughtError instanceof Error ? caughtError.message : 'Unable to confirm import.',
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  function changeType(value: MediaTypeCode) {
    setSelectedType(value);
    setPage(1);
  }

  async function submitNicheTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = query.trim();
    const genres = manualGenres
      .split(',')
      .map((genre) => genre.trim())
      .filter(Boolean);
    if (title.length < 2) {
      setActionError('Enter a title with at least two characters.');
      return;
    }
    if (genres.length > 12 || genres.some((genre) => genre.length > 100)) {
      setActionError('Enter up to 12 genres, each no longer than 100 characters.');
      return;
    }
    setManualSubmitting(true);
    setActionError('');
    try {
      await submitManualMedia({
        title,
        mediaType: selectedType,
        description: manualDescription.trim() || undefined,
        genres,
      });
      setManualSubmitted(true);
      setMessage(
        `${title} was submitted for catalogue review. It will be available after approval.`,
      );
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error ? caughtError.message : 'Unable to submit this title.',
      );
    } finally {
      setManualSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Find something new" title="Discovery and import">
        Search the MediaHub catalogue for movies, TV shows, and anime. Discover books and manga
        through external providers, then import them into the correct library.
      </PageHeader>

      <RecommendationSection
        libraryMediaIds={libraryMediaIds}
        libraryLoading={libraryLoading}
        onLibraryChanged={() => setSearchVersion((version) => version + 1)}
      />

      <section className="surface">
        <form onSubmit={handleSearch}>
          <label htmlFor="discovery-query">Search titles</label>
          <div className="control-row">
            <input
              id="discovery-query"
              type="search"
              minLength={2}
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
                onChange={(event) => changeType(event.target.value as MediaTypeCode)}
              >
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
      {pendingImport && (
        <section className="surface" aria-label="Import preview">
          <h2>Preview import: {pendingImport.item.title}</h2>
          <p>
            {pendingImport.item.provider} ·{' '}
            <a href={pendingImport.item.sourceUrl} target="_blank" rel="noreferrer">
              View provider source
            </a>
          </p>
          {pendingImport.candidate.match &&
          libraryMediaIds.has(pendingImport.candidate.match.id) ? (
            <p role="status">This title already exists in your list.</p>
          ) : (
            <p>
              Proposed action:{' '}
              {pendingImport.candidate.proposedAction.replaceAll('_', ' ').toLowerCase()}.
            </p>
          )}
          {pendingImport.candidate.match ? (
            <p>
              Possible MediaHub match: <strong>{pendingImport.candidate.match.title}</strong>
              {libraryMediaIds.has(pendingImport.candidate.match.id)
                ? ' (already in your library)'
                : ''}
            </p>
          ) : (
            <p>No existing MediaHub match was found.</p>
          )}
          {!(
            pendingImport.candidate.match && libraryMediaIds.has(pendingImport.candidate.match.id)
          ) && (
            <div className="inline-actions">
              {pendingImport.candidate.match && (
                <button
                  className="button button-primary"
                  disabled={busyId !== null}
                  onClick={() => void confirmPendingImport('REUSE')}
                  type="button"
                >
                  Reuse existing title
                </button>
              )}
              <button
                className="tab"
                disabled={busyId !== null}
                onClick={() => void confirmPendingImport('CREATE')}
                type="button"
              >
                Create new title
              </button>
              <button
                className="tab"
                disabled={busyId !== null}
                onClick={() => void confirmPendingImport('SKIP')}
                type="button"
              >
                Skip
              </button>
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="surface" role="status">
          Searching…
        </div>
      ) : submittedQuery && results.length === 0 && !error ? (
        <EmptyState title="No matching titles found">
          {selectedType === 'TV'
            ? 'Try another search. TV has no configured external provider.'
            : 'Try another search, or submit this niche title for review below.'}
        </EmptyState>
      ) : results.length > 0 ? (
        <>
          <section className="page-stack" aria-label="Search results">
            <p>
              Found {totalItems} matching title{totalItems === 1 ? '' : 's'}.
            </p>
            {results.map((result) => {
              const item = result.item;
              const isCatalogueItem = result.kind === 'catalogue';
              const itemId = result.kind === 'catalogue' ? result.item.id : result.item.externalId;
              const isProviderItem = result.kind === 'provider';
              const alreadyInLibrary = isCatalogueItem
                ? isCatalogueItemInLibrary(result.item.id, libraryMediaIds)
                : isProviderItemInLibrary(result.item, libraryEntries);
              const isCheckingLibrary = (isCatalogueItem || isProviderItem) && libraryLoading;
              const genres =
                result.kind === 'catalogue'
                  ? result.item.genres.map((genre) => genre.name)
                  : result.item.genres;
              const mediaTypeName =
                result.kind === 'catalogue' ? result.item.mediaType.name : result.item.mediaType;
              return (
                <article className="surface" key={`${result.kind}:${itemId}`}>
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
                        {mediaTypeName}
                        {item.releaseDate ? ` · ${item.releaseDate.slice(0, 10)}` : ''}
                      </p>
                      {item.description && <p>{item.description}</p>}
                      {result.kind === 'provider' && (
                        <p className="source-attribution">
                          Source: {result.item.provider} ·{' '}
                          <a href={result.item.sourceUrl} target="_blank" rel="noreferrer">
                            Provider record
                          </a>
                        </p>
                      )}
                      <p>Genres: {genres.join(', ') || 'Not specified'}</p>
                      {result.kind === 'catalogue' && (
                        <p>Total units: {result.item.totalUnits ?? 'Unknown'}</p>
                      )}
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={isCheckingLibrary || alreadyInLibrary || busyId === itemId}
                        onClick={() => {
                          if (result.kind === 'catalogue') {
                            void handleAddCatalogueItem(result.item);
                          } else {
                            void handleImport(result.item);
                          }
                        }}
                      >
                        {busyId === itemId
                          ? isCatalogueItem
                            ? 'Adding…'
                            : 'Importing…'
                          : isCheckingLibrary
                            ? 'Checking library…'
                            : alreadyInLibrary
                              ? 'Already in Library'
                              : isCatalogueItem
                                ? 'Add to Library'
                                : 'Import to Library'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
          <Pagination page={page} totalPages={totalPages} disabled={loading} onChange={setPage} />
        </>
      ) : (
        <EmptyState title="Search for a title">
          Choose a media type and search the catalogue or its supported external provider.
        </EmptyState>
      )}
      {submittedQuery &&
        !loading &&
        !error &&
        results.length === 0 &&
        externalSearchAttempted &&
        !manualSubmitted && (
          <section className="surface">
            <h2>Submit a niche title</h2>
            <p className="muted">
              External search returned no match. Submissions are queued for admin review before they
              appear in the catalogue.
            </p>
            <form className="manual-title-form" onSubmit={(event) => void submitNicheTitle(event)}>
              <label htmlFor="manual-title">Title</label>
              <input
                id="manual-title"
                maxLength={300}
                required
                minLength={2}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <label htmlFor="manual-description">Description (optional)</label>
              <textarea
                id="manual-description"
                maxLength={5000}
                value={manualDescription}
                onChange={(event) => setManualDescription(event.target.value)}
              />
              <label htmlFor="manual-genres">Genres (comma separated, optional)</label>
              <input
                id="manual-genres"
                maxLength={1200}
                value={manualGenres}
                onChange={(event) => setManualGenres(event.target.value)}
              />
              <button className="button button-primary" disabled={manualSubmitting} type="submit">
                {manualSubmitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </form>
          </section>
        )}
    </div>
  );
}
