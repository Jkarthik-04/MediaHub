import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/PageStates';
export function RecommendationsPage() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="For you" title="Recommendations">
        Explainable cross-media suggestions will display their score and the taste evidence behind
        them.
      </PageHeader>
      <EmptyState title="Recommendations are not available yet">
        The recommendation schema exists, but its Phase 8 API and generation workflow have not been
        implemented.
      </EmptyState>
    </div>
  );
}
