import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/PageStates';
export function LibraryPage({
  title,
  description,
  tabs,
}: {
  title: string;
  description: string;
  tabs: string[];
}) {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Personal library" title={title}>
        {description}
      </PageHeader>
      <section className="surface">
        <div className="tab-list" role="tablist" aria-label={`${title} media types`}>
          {tabs.map((tab, index) => (
            <button aria-selected={index === 0} className="tab" key={tab} role="tab" type="button">
              {tab}
            </button>
          ))}
        </div>
        <div className="filter-grid">
          <input aria-label="Search library" disabled placeholder="Search titles" />
          <select aria-label="Filter by status" disabled defaultValue="">
            <option value="">All statuses</option>
          </select>
          <select aria-label="Sort library" disabled defaultValue="">
            <option value="">Last updated</option>
          </select>
        </div>
      </section>
      <EmptyState title={`No ${title.toLowerCase()} entries to show`}>
        Filters, pagination, editing, and progress controls will use the existing Phase 5 library
        APIs in the next UI stage.
      </EmptyState>
    </div>
  );
}
