type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-200 text-slate-900 ring-1 ring-inset ring-slate-300 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-0',
  success: 'bg-emerald-200 text-emerald-900 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-0',
  warning: 'bg-amber-200 text-amber-900 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-0',
  error: 'bg-rose-200 text-rose-900 ring-1 ring-inset ring-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-0',
  info: 'bg-cyan-200 text-cyan-900 ring-1 ring-inset ring-cyan-300 dark:bg-cyan-500/15 dark:text-cyan-200 dark:ring-0',
  purple: 'bg-violet-200 text-violet-900 ring-1 ring-inset ring-violet-300 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-0',
};

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
