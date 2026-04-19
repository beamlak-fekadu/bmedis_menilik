'use client';

import { useState } from 'react';
import Link from 'next/link';
import { resetPassword } from '@/services/auth.service';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { APP_NAME_SHORT } from '@/constants';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: resetError } = await resetPassword(email);
    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="flex flex-col text-center">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--foreground)]">{APP_NAME_SHORT}</p>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-[var(--foreground)]">Check your email</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
          We sent a password reset link to <span className="font-medium text-[var(--foreground)]">{email}</span>
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-transparent px-8 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-10 text-center sm:mb-11">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--foreground)]">{APP_NAME_SHORT}</p>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-[var(--foreground)]">Reset password</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Enter your email to receive a secure reset link.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-7 sm:space-y-8">
        <Input
          appearance="minimal"
          label="Email"
          labelClassName="!text-sky-700/95 dark:!text-sky-400/90"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yekatit12.gov.et"
          required
          autoComplete="email"
          autoFocus
        />
        {error && (
          <p role="alert" className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-200 dark:text-red-100">
            {error}
          </p>
        )}
        <div className="pt-2">
          <Button
            type="submit"
            loading={loading}
            size="lg"
            className="w-full !rounded-full !bg-[#0ea5e9] !text-white text-sm font-semibold uppercase tracking-[0.1em] shadow-[0_12px_36px_-10px_rgb(14_165_233/0.5)] transition-[background-color,box-shadow] hover:!bg-[#0284c7] hover:shadow-[0_14px_40px_-10px_rgb(2_132_199/0.52)] focus-visible:!ring-sky-400 disabled:!bg-[var(--surface-3)] disabled:!text-[var(--foreground)] disabled:!shadow-none"
          >
            Send reset link
          </Button>
        </div>
      </form>
      <div className="mt-8 flex justify-center">
        <Link
          href="/login"
          className="text-sm text-[var(--text-muted)] underline-offset-4 transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
