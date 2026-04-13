type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-500/15 text-slate-300',
  success: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-300',
  error: 'bg-rose-500/15 text-rose-300',
  info: 'bg-cyan-500/15 text-cyan-300',
  purple: 'bg-violet-500/15 text-violet-300',
};

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
