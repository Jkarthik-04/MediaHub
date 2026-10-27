import type { ReactNode } from 'react';

export function FilterBar({
  children,
  label = 'Search and filter controls',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="filter-grid" role="group" aria-label={label}>
      {children}
    </div>
  );
}
