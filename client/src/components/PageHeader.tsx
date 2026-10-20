import type { ReactNode } from 'react';
export function PageHeader({
  eyebrow = 'MediaHub',
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-description">{children}</p>
    </header>
  );
}
