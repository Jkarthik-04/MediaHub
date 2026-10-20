import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/PageStates';
export function DiscoveryPage() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Find something new" title="Discovery and import">
        Search providers, inspect normalized results, then preview an import before saving it.
      </PageHeader>
      <section className="surface">
        <label htmlFor="discovery-query">Search titles</label>
        <div className="control-row">
          <input
            disabled
            id="discovery-query"
            placeholder="Search will be wired in the discovery stage"
          />
          <button className="button button-primary" disabled type="button">
            Search
          </button>
        </div>
      </section>
      <EmptyState title="Search is not connected yet">
        The Phase 5 provider and import APIs are preserved. This stage establishes their future page
        and UI states.
      </EmptyState>
    </div>
  );
}
