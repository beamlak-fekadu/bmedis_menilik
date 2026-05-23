'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Mail, Send } from 'lucide-react';
import { requestBmedisSystemTrainingAction } from '@/actions/bmedis-training.actions';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

export type BmedisTrainingRequestDefaults = {
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  department_name: string;
  role_title: string;
};

type TrainingMode = 'online' | 'onsite' | 'hybrid';

const FOCUS_AREAS = [
  'BMEDIS overview and navigation',
  'Requests and approvals',
  'Preventive maintenance workflow',
  'Calibration workflow',
  'QR labels and asset scanning',
  'Reports and dashboards',
  'User and role management',
  'Offline sync and field use',
];

export default function BmedisTrainingRequestForm({ defaults }: { defaults: BmedisTrainingRequestDefaults }) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    requester_name: defaults.requester_name,
    requester_email: defaults.requester_email,
    requester_phone: defaults.requester_phone,
    organization: '',
    department_name: defaults.department_name,
    role_title: defaults.role_title,
    training_mode: 'online' as TrainingMode,
    audience_size: '5',
    preferred_date: '',
    alternate_date: '',
    focus_areas: ['BMEDIS overview and navigation', 'Requests and approvals'],
    goals: '',
  });

  const focusSummary = useMemo(() => {
    if (form.focus_areas.length === 0) return 'No focus areas selected';
    if (form.focus_areas.length === 1) return form.focus_areas[0];
    return `${form.focus_areas.length} focus areas selected`;
  }, [form.focus_areas]);

  function toggleFocusArea(area: string) {
    setForm((current) => ({
      ...current,
      focus_areas: current.focus_areas.includes(area)
        ? current.focus_areas.filter((item) => item !== area)
        : [...current.focus_areas, area],
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.focus_areas.length === 0) {
      toast('warning', 'Select at least one training focus area');
      return;
    }
    if (form.goals.trim().length < 20) {
      toast('warning', 'Describe the training goals in a little more detail');
      return;
    }

    setSubmitting(true);
    const result = await requestBmedisSystemTrainingAction({
      ...form,
      audience_size: form.audience_size,
    });
    setSubmitting(false);

    if (!result.success) {
      toast('error', result.error ?? 'Failed to send training request');
      return;
    }

    const warning = (result.data as { warning?: string | null } | undefined)?.warning;
    toast(warning ? 'warning' : 'success', warning ?? 'BMEDIS training request sent');
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-5 p-2 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--success)]/15 text-[var(--success)]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Training request sent</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Your BMEDIS system training request was emailed to the coordination inbox. The team can use your reply-to address to follow up on dates and scope.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => router.push('/requests')}>
                Back to Requests
              </Button>
              <Button type="button" variant="outline" onClick={() => setSubmitted(false)}>
                Send Another
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Training Coordination Details</CardTitle>
          <CardDescription>
            This sends an email request to beamlak.work@gmail.com with the BME Head contact details and requested training scope.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="BME Head Name *"
              value={form.requester_name}
              onChange={(event) => setForm((current) => ({ ...current, requester_name: event.target.value }))}
              placeholder="Full name"
              required
            />
            <Input
              label="Email *"
              type="email"
              value={form.requester_email}
              onChange={(event) => setForm((current) => ({ ...current, requester_email: event.target.value }))}
              placeholder="name@example.com"
              required
            />
            <Input
              label="Phone"
              value={form.requester_phone}
              onChange={(event) => setForm((current) => ({ ...current, requester_phone: event.target.value }))}
              placeholder="Phone or WhatsApp"
            />
            <Input
              label="Role / Title *"
              value={form.role_title}
              onChange={(event) => setForm((current) => ({ ...current, role_title: event.target.value }))}
              required
            />
            <Input
              label="Organization / Facility *"
              value={form.organization}
              onChange={(event) => setForm((current) => ({ ...current, organization: event.target.value }))}
              placeholder="Hospital or facility name"
              required
            />
            <Input
              label="Department"
              value={form.department_name}
              onChange={(event) => setForm((current) => ({ ...current, department_name: event.target.value }))}
              placeholder="Biomedical Engineering"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Training Mode *"
              value={form.training_mode}
              onChange={(event) => setForm((current) => ({ ...current, training_mode: event.target.value as TrainingMode }))}
              options={[
                { value: 'online', label: 'Online' },
                { value: 'onsite', label: 'On-site' },
                { value: 'hybrid', label: 'Hybrid' },
              ]}
            />
            <Input
              label="Expected Audience *"
              type="number"
              min={1}
              value={form.audience_size}
              onChange={(event) => setForm((current) => ({ ...current, audience_size: event.target.value }))}
              required
            />
            <Input
              label="Preferred Date"
              type="date"
              value={form.preferred_date}
              onChange={(event) => setForm((current) => ({ ...current, preferred_date: event.target.value }))}
            />
            <Input
              label="Alternate Date"
              type="date"
              value={form.alternate_date}
              onChange={(event) => setForm((current) => ({ ...current, alternate_date: event.target.value }))}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-[var(--foreground)]">Training Focus Areas *</legend>
            <p className="text-xs text-[var(--text-muted)]">{focusSummary}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FOCUS_AREAS.map((area) => (
                <label
                  key={area}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--brand)]/60"
                >
                  <input
                    type="checkbox"
                    checked={form.focus_areas.includes(area)}
                    onChange={() => toggleFocusArea(area)}
                    className="h-4 w-4 rounded border-[var(--border-subtle)]"
                  />
                  <span>{area}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Textarea
            label="Training Goals / Coordination Notes *"
            value={form.goals}
            onChange={(event) => setForm((current) => ({ ...current, goals: event.target.value }))}
            placeholder="Describe who needs training, what workflows matter most, preferred timing, and any coordination constraints."
            rows={6}
            required
          />

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <Button type="button" variant="outline" onClick={() => router.push('/requests')}>
              Back to Requests
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? <Mail className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              Send Request
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
