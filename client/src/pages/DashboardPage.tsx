import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/PageStates';
export function DashboardPage() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Your library" title="Dashboard">
        A single place for your reading and watching activity.
      </PageHeader>
      <section className="metric-grid" aria-label="Dashboard summary placeholders">
        {['Titles in library', 'In progress', 'Completed', 'Favourite genres'].map((label) => (
          <article className="metric-card" key={label}>
            <p>{label}</p>
            <strong>—</strong>
          </article>
        ))}
      </section>
      <EmptyState title="Your dashboard is ready for data">
        Dashboard queries will be connected after Phase 6 establishes the real authenticated-user
        flow.
      </EmptyState>
    </div>
  );
}
