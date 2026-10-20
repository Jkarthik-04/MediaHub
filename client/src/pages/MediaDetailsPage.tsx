import { useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
export function MediaDetailsPage() {
  const { mediaId } = useParams();
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Catalogue item" title="Media details">
        Cover art, metadata, provider attribution, units, and your library state will appear here.
      </PageHeader>
      <section className="surface">
        <p className="muted">
          Route prepared for media ID: <code>{mediaId}</code>
        </p>
      </section>
    </div>
  );
}
