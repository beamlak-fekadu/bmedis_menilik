'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)]">{icon}</div>}
          <input
            ref={ref}
            id={inputId}
            className={`block w-full rounded-xl border px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 ${
              error
                ? 'border-red-400/70 bg-[var(--surface-2)] text-[var(--foreground)] focus:border-red-400 focus:ring-red-400'
                : 'border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--foreground)] focus:border-[var(--brand)] focus:ring-[var(--brand)]'
            } ${icon ? 'pl-10' : ''} ${className}`}
            {...props}
          />
        </div>
        {hint && !error && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
