import type { ReactNode } from 'react';

type Props = { title: string; children: ReactNode; action?: ReactNode };
function StatePanel({ title, children, action }: Props) {
  return (
    <section className="state-panel">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}
export function LoadingState({ label = 'Loading content…' }: { label?: string }) {
  return (
    <section aria-busy="true" aria-live="polite" className="loading-state">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </section>
  );
}
export function SkeletonLoader({ label = 'Loading content' }: { label?: string }) {
  return (
    <section aria-label={label} aria-busy="true" className="skeleton-list">
      {[0, 1, 2].map((row) => (
        <div className="skeleton-row" key={row}>
          <span className="skeleton-block skeleton-cover" />
          <span className="skeleton-copy">
            <i className="skeleton-block" />
            <i className="skeleton-block short" />
          </span>
        </div>
      ))}
    </section>
  );
}
export function ErrorState(props: Props) {
  return <StatePanel {...props} />;
}
export function EmptyState(props: Props) {
  return <StatePanel {...props} />;
}
