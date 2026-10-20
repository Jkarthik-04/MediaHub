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
export function ErrorState(props: Props) {
  return <StatePanel {...props} />;
}
export function EmptyState(props: Props) {
  return <StatePanel {...props} />;
}
