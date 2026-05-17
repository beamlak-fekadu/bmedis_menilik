import { type ReactNode } from 'react';
import Link from 'next/link';
import InfoPopover from './InfoPopover';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  /** When set, the description is rendered behind a small (i) button next to the title instead of inline. */
  descriptionInfo?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
}

export default function PageHeader({ title, description, descriptionInfo, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-sm text-[var(--text-muted)]">
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              {bc.href ? (
                <Link href={bc.href} className="hover:text-[var(--foreground)]">{bc.label}</Link>
              ) : (
                <span className="text-[var(--foreground)]">{bc.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-xl font-bold text-[var(--foreground)] sm:text-2xl">{title}</h1>
            {descriptionInfo && <InfoPopover align="left">{descriptionInfo}</InfoPopover>}
          </div>
          {description && !descriptionInfo && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
