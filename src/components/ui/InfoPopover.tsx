'use client';

import { Info } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface InfoPopoverProps {
  children: ReactNode;
  label?: string;
  align?: 'left' | 'right';
  className?: string;
}

export default function InfoPopover({ children, label = 'More info', align = 'right', className = '' }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-flex print:hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="dialog"
          className={`panel-surface absolute top-8 z-20 w-80 rounded-xl p-3 text-sm leading-relaxed text-[var(--foreground)] shadow-[var(--shadow-lg)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
