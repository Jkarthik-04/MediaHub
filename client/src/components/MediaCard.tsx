import { Link } from 'react-router-dom';

type Props = {
  id: string;
  title: string;
  type: string;
  coverUrl: string | null;
  detail?: string;
};

export function MediaCard({ id, title, type, coverUrl, detail }: Props) {
  return (
    <Link className="dashboard-media-card" to={`/media/${id}`}>
      {coverUrl ? (
        <img src={coverUrl} alt="" loading="lazy" />
      ) : (
        <span className="cover-placeholder" aria-hidden="true">
          No cover
        </span>
      )}
      <span className="dashboard-media-copy">
        <strong>{title}</strong>
        <span>{type}</span>
        {detail && <span>{detail}</span>}
      </span>
    </Link>
  );
}
