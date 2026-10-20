import { PageHeader } from '../components/PageHeader';
import { ErrorState } from '../components/PageStates';
export function AdminPage() {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Administration" title="Admin workspace">
        User roles, manual-title review, provider health, ingestion jobs, and audit records will be
        managed here.
      </PageHeader>
      <ErrorState title="Admin features are not available in this stage">
        Phase 6 authentication and server-side role authorization are prerequisites. This page
        deliberately does not infer or simulate admin access.
      </ErrorState>
    </div>
  );
}
