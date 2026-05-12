import Link from 'next/link';
import type { ReactNode } from 'react';

type Tone = 'primary' | 'secondary' | 'destructive' | 'warning' | 'success' | 'info';
type Size = 'sm' | 'md';

const toneStyles: Record<Tone, string> = {
  primary: 'border-transparent bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]',
  secondary: 'border-[var(--border-subtle)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-2)]',
  destructive: 'border-transparent bg-[var(--danger)] text-white hover:bg-red-500',
  warning: 'border-transparent bg-amber-600 text-white hover:bg-amber-500',
  success: 'border-transparent bg-emerald-600 text-white hover:bg-emerald-500',
  info: 'border-transparent bg-blue-600 text-white hover:bg-blue-500',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export function operationalActionClass(tone: Tone = 'secondary', size: Size = 'sm') {
  return `inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition ${toneStyles[tone]} ${sizeStyles[size]}`;
}

interface OperationalActionProps {
  href: string;
  children: ReactNode;
  tone?: Tone;
  size?: Size;
  className?: string;
}

export default function OperationalAction({ href, children, tone = 'secondary', size = 'sm', className = '' }: OperationalActionProps) {
  return (
    <Link href={href} className={`${operationalActionClass(tone, size)} ${className}`}>
      {children}
    </Link>
  );
}
