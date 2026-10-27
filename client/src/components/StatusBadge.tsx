import type { LibraryStatus } from '../services/mediahub-api';

export function StatusBadge({ status }: { status: LibraryStatus }) {
  return (
    <span className={`status-badge status-${status.toLowerCase().replaceAll('_', '-')}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
