'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Beaker,
  ClipboardList,
  Copy,
  FileText,
  GraduationCap,
  Layers,
  Package,
  QrCode,
  ShieldAlert,
  Stethoscope,
  Truck,
  Wrench,
} from 'lucide-react';

export type QrActionIcon =
  | 'asset'
  | 'beaker'
  | 'clipboard'
  | 'copy'
  | 'file'
  | 'graduation'
  | 'package'
  | 'qr'
  | 'shield'
  | 'stethoscope'
  | 'truck'
  | 'wrench';

export type QrAction = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  copyText?: string | null;
  icon: QrActionIcon;
  variant?: 'primary' | 'secondary' | 'warning' | 'success';
};

const iconMap = {
  asset: Layers,
  beaker: Beaker,
  clipboard: ClipboardList,
  copy: Copy,
  file: FileText,
  graduation: GraduationCap,
  package: Package,
  qr: QrCode,
  shield: ShieldAlert,
  stethoscope: Stethoscope,
  truck: Truck,
  wrench: Wrench,
} satisfies Record<QrActionIcon, typeof Wrench>;

function cardClass(variant: QrAction['variant']) {
  if (variant === 'primary') {
    return 'border-[var(--brand)]/70 bg-[var(--brand)]/10 hover:bg-[var(--brand)]/15';
  }
  if (variant === 'warning') {
    return 'border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/15';
  }
  if (variant === 'success') {
    return 'border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/15';
  }
  return 'border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-[var(--brand)]/40';
}

function iconClass(variant: QrAction['variant']) {
  if (variant === 'warning') return 'text-amber-300';
  if (variant === 'success') return 'text-emerald-300';
  if (variant === 'primary') return 'text-[var(--brand)]';
  return 'text-[var(--text-muted)]';
}

export default function QrRoleActions({ actions }: { actions: QrAction[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyAction(action: QrAction) {
    if (!action.copyText) return;
    await navigator.clipboard.writeText(action.copyText);
    setCopiedId(action.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  if (actions.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 text-sm text-[var(--text-muted)]">
        No QR actions are available for this role and asset.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map((action) => {
        const Icon = iconMap[action.icon];
        const content = (
          <>
            <div className="flex flex-1 items-start gap-3">
              <Icon className={`mt-0.5 h-5 w-5 ${iconClass(action.variant)}`} />
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {copiedId === action.id ? 'Copied QR URL' : action.label}
                </p>
                {action.description && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{action.description}</p>
                )}
              </div>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 text-[var(--text-muted)] transition group-hover:translate-x-0.5" />
          </>
        );
        const className = `group flex min-h-24 items-start justify-between gap-3 rounded-xl border p-4 text-left transition ${cardClass(action.variant)}`;

        if (action.copyText) {
          return (
            <button key={action.id} type="button" onClick={() => void copyAction(action)} className={className}>
              {content}
            </button>
          );
        }

        if (!action.href) return null;
        return (
          <Link key={action.id} href={action.href} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
