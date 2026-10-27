import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, ErrorState, SkeletonLoader } from '../components/PageStates';
import { PageHeader } from '../components/PageHeader';
import { MediaCard } from '../components/MediaCard';
import { SearchField } from '../components/SearchField';
import {
  getDashboardSummary,
  getLibrary,
  searchMedia,
  type DashboardSummary,
  type LibraryEntry,
  type MediaCatalogueItem,
} from '../services/mediahub-api';

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [continueReading, setContinueReading] = useState<LibraryEntry[]>([]);
  const [continueWatching, setContinueWatching] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaCatalogueItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        const [summaryResponse, readingResponse, watchingResponse] = await Promise.all([
          getDashboardSummary(),
          getLibrary({ section: 'READING', status: 'IN_PROGRESS', page: 1, limit: 4 }),
          getLibrary({ section: 'WATCHING', status: 'IN_PROGRESS', page: 1, limit: 4 }),
        ]);
        if (cancelled) return;
        setSummary(summaryResponse.data);
        setContinueReading(readingResponse.data);
        setContinueWatching(watchingResponse.data);
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error ? caughtError.message : 'Unable to load dashboard.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    setSearched(true);
    if (term.length < 1) {
      setSearchResults([]);
      setSearchError('Enter a title to search the catalogue.');
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    try {
      const response = await searchMedia({ q: term, page: 1, limit: 8, sort: 'title:asc' });
      setSearchResults(response.data);
    } catch (caughtError) {
      setSearchResults([]);
      setSearchError(
        caughtError instanceof Error ? caughtError.message : 'Catalogue search failed.',
      );
    } finally {
      setSearchLoading(false);
    }
  }

  if (loading) return <SkeletonLoader label="Loading your dashboard" />;
  if (error) {
    return (
      <div className="page-stack">
        <PageHeader eyebrow="Your library" title="Dashboard">
          Your reading and watching activity in one place.
        </PageHeader>
        <ErrorState title="Unable to load your dashboard">
          {error} Try again by refreshing the page.
        </ErrorState>
      </div>
    );
  }
  if (!summary) return null;

  const inProgressCount =
    summary.overview.byStatus.find((item) => item.status === 'IN_PROGRESS')?.count ?? 0;
  const completedCount =
    summary.overview.byStatus.find((item) => item.status === 'COMPLETED')?.count ?? 0;
  const continueItems = [...continueReading, ...continueWatching];

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Your library" title="Dashboard">
        A combined view of what you are reading, watching, and recently completed.
      </PageHeader>

      <section className="metric-grid" aria-label="Library overview">
        {[
          ['Titles in library', summary.overview.totalTitles],
          ['In progress', inProgressCount],
          ['Completed', completedCount],
          ['Favourite genres', summary.topGenres.length],
        ].map(([label, value]) => (
          <article className="metric-card" key={String(label)}>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="surface">
        <h2>Find a title</h2>
        <SearchField
          id="dashboard-title-search"
          label="Search all catalogue titles"
          maxLength={300}
          onChange={setQuery}
          onSubmit={(event) => void handleSearch(event)}
          placeholder="Search books, manga, movies, TV, or anime"
          value={query}
          disabled={searchLoading}
        />
        {searchError && (
          <p className="form-error" role="alert">
            {searchError}
          </p>
        )}
        {searched && !searchLoading && !searchError && searchResults.length === 0 && (
          <EmptyState title="No matching catalogue titles">Try a different search.</EmptyState>
        )}
        {searchResults.length > 0 && (
          <ul className="dashboard-search-results">
            {searchResults.map((item) => (
              <li key={item.id}>
                <Link to={`/media/${item.id}`}>
                  <strong>{item.title}</strong>
                  <span>{item.mediaType.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface">
        <div className="section-heading">
          <h2>Continue where you left off</h2>
          <div className="inline-links">
            <Link to="/reading">Reading</Link>
            <Link to="/watching">Watching</Link>
          </div>
        </div>
        {continueItems.length === 0 ? (
          <p className="muted">Titles marked In Progress will appear here.</p>
        ) : (
          <div className="dashboard-card-grid">
            {continueItems.map((entry) => (
              <MediaCard
                id={entry.mediaItem.id}
                key={entry.id}
                title={entry.mediaItem.title}
                type={entry.mediaItem.mediaType.code}
                coverUrl={entry.mediaItem.coverUrl}
                detail={`${entry.progressValue ?? 0}${
                  entry.mediaItem.mediaType.progressMode === 'PERCENTAGE'
                    ? '%'
                    : ` / ${entry.mediaItem.totalUnits ?? '?'} units`
                }`}
              />
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-columns">
        <section className="surface">
          <h2>Counts by media type</h2>
          <ul className="data-list">
            {summary.overview.byMediaType.map((item) => (
              <li key={item.code}>
                <span>{item.name}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="surface">
          <h2>Counts by status</h2>
          <ul className="data-list">
            {summary.overview.byStatus.map((item) => (
              <li key={item.status}>
                <span>{item.status.replaceAll('_', ' ')}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="dashboard-columns">
        <section className="surface">
          <h2>Recently updated</h2>
          {summary.recentEntries.length === 0 ? (
            <p className="muted">Your recent activity will appear here.</p>
          ) : (
            <ul className="data-list">
              {summary.recentEntries.map((entry) => (
                <li key={entry.id}>
                  <Link to={`/media/${entry.mediaItem.id}`}>{entry.mediaItem.title}</Link>
                  <span>{new Date(entry.updatedAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="surface">
          <h2>Favourite genres</h2>
          {summary.topGenres.length === 0 ? (
            <p className="muted">Add titles with genres to build your taste profile.</p>
          ) : (
            <ul className="data-list">
              {summary.topGenres.map((genre) => (
                <li key={genre.slug}>
                  <span>{genre.name}</span>
                  <strong>{genre.titleCount}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="surface">
        <h2>Completion activity</h2>
        {summary.completionsByMonth.length === 0 ? (
          <p className="muted">Completed titles will appear here by month.</p>
        ) : (
          <ul className="completion-list">
            {summary.completionsByMonth.map((item) => (
              <li key={item.month}>
                <span>{item.month}</span>
                <span className="completion-bar" aria-label={`${item.count} completions`}>
                  <i
                    style={{
                      width: `${Math.max(4, (item.count / Math.max(...summary.completionsByMonth.map((entry) => entry.count))) * 100)}%`,
                    }}
                  />
                </span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface">
        <h2>Recommendation preview</h2>
        <p className="muted">
          Recommendation generation is not available in the current API yet. Your top genres above
          summarize the taste data that a future recommendation service can use.
        </p>
      </section>
    </div>
  );
}
