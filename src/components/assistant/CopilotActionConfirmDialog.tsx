'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button, Modal, Textarea, Input } from '@/components/ui';
import type { CopilotActionDraft } from '@/types/copilot-actions';

interface CopilotActionConfirmDialogProps {
  open: boolean;
  draft: CopilotActionDraft;
  submitting: boolean;
  offlineHint?: string;
  onCancel: () => void;
  onConfirm: (overrides: Record<string, string | number | boolean | null>) => Promise<void>;
}

function fieldInitialValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function CopilotActionConfirmDialogInner(props: Omit<CopilotActionConfirmDialogProps, 'open'>) {
  const { draft, submitting, offlineHint, onCancel, onConfirm } = props;
  const editableFields = draft.fields.filter((field) => field.editable);
  const readonlyFields = draft.fields.filter((field) => !field.editable);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of editableFields) initial[field.name] = fieldInitialValue(field.value);
    return initial;
  });

  const handleSubmit = async () => {
    const overrides: Record<string, string | number | boolean | null> = {};
    for (const field of editableFields) {
      const raw = values[field.name];
      if (raw === undefined) continue;
      const trimmed = raw.trim();
      if (trimmed === '') {
        overrides[field.name] = field.required ? '' : null;
        continue;
      }
      overrides[field.name] = trimmed;
    }
    await onConfirm(overrides);
  };

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={draft.title}
      size="lg"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            Server re-validates fields before any record is created.
          </p>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSubmit()} loading={submitting}>
              <ShieldAlert className="h-4 w-4" />
              Confirm & submit
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-[var(--text-muted)]">{draft.description}</p>

        {offlineHint ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
            {offlineHint}
          </div>
        ) : null}

        {draft.validationWarnings.length > 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
            <p className="font-semibold">Review before confirming:</p>
            <ul className="list-disc pl-4">
              {draft.validationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {readonlyFields.length > 0 ? (
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] p-2 text-xs">
            <p className="mb-1 font-semibold">Linked context</p>
            <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {readonlyFields.map((field) => (
                <div key={field.name}>
                  <dt className="text-[var(--text-muted)]">{field.label}</dt>
                  <dd className="break-all">{fieldInitialValue(field.value) || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {editableFields.length > 0 ? (
          <div className="space-y-3">
            {editableFields.map((field) => {
              const value = values[field.name] ?? '';
              const isLong = field.name === 'fault_description' || field.name === 'description' || field.name === 'justification' || field.name === 'notes' || field.name === 'closure_notes' || field.name === 'summary';
              return (
                <div key={field.name}>
                  <label className="mb-1 block text-xs font-semibold text-[var(--foreground)]">
                    {field.label}
                    {field.required ? <span className="ml-1 text-red-400">*</span> : null}
                  </label>
                  {isLong ? (
                    <Textarea
                      rows={3}
                      value={value}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      value={value}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    />
                  )}
                  {field.helpText ? <p className="mt-1 text-[10px] text-[var(--text-muted)]">{field.helpText}</p> : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {draft.evidenceUsed.length > 0 ? (
          <div className="text-xs text-[var(--text-muted)]">
            <p className="font-semibold text-[var(--foreground)]">Evidence used</p>
            <ul className="list-disc pl-4">
              {draft.evidenceUsed.slice(0, 6).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function CopilotActionConfirmDialog(props: CopilotActionConfirmDialogProps) {
  if (!props.open) return null;
  // Remount inner on draft change so useState() initializer reflects new fields.
  return <CopilotActionConfirmDialogInner key={props.draft.id} {...props} />;
}
