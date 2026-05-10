'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarClock, CheckCircle, ClipboardList, GraduationCap, Plus, ShieldAlert, Users, ChevronLeft } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Table from '@/components/ui/Table';
import Card from '@/components/ui/Card';
import { CardHeader, CardTitle } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  getTrainingSessions,
  getStaffTrainingRecords,
  getTrainingRequests,
} from '@/services/training.service';
import { createTrainingRequestAction, createTrainingSessionAction } from '@/actions/training.actions';
import { getEquipmentList } from '@/services/equipment.service';
import * as settingsService from '@/services/settings.service';
import type { TrainingType, TrainingAttendance } from '@/types/domain';
import { useRole } from '@/hooks/useRole';

type SessionRow = Record<string, unknown>;
type RequestRow = Record<string, unknown>;
type AttendeeRow = Record<string, unknown>;

const trainingTypeOptions: { value: TrainingType; label: string }[] = [
  { value: 'equipment_operation', label: 'Equipment Operation' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'safety', label: 'Safety' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'refresher', label: 'Refresher' },
  { value: 'other', label: 'Other' },
];

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  pending: 'warning',
  approved: 'info',
  scheduled: 'purple',
  completed: 'success',
  rejected: 'error',
  canceled: 'default',
};

const attendanceVariant: Record<TrainingAttendance, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  registered: 'info',
  attended: 'success',
  absent: 'error',
  certified: 'purple',
};

function formatLabel(val: string) {
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TrainingPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { canManageMaintenance, primaryRole } = useRole();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [assets, setAssets] = useState<{ value: string; label: string }[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<SessionRow | null>(null);
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // Session form
  const [sesTitle, setSesTitle] = useState('');
  const [sesAssetId, setSesAssetId] = useState('');
  const [sesCategoryId, setSesCategoryId] = useState('');
  const [sesTrainer, setSesTrainer] = useState('');
  const [sesDate, setSesDate] = useState('');
  const [sesDuration, setSesDuration] = useState('');
  const [sesLocation, setSesLocation] = useState('');
  const [sesDescription, setSesDescription] = useState('');
  const [sesMaxParticipants, setSesMaxParticipants] = useState('');

  // Request form
  const [reqAssetId, setReqAssetId] = useState('');
  const [reqType, setReqType] = useState<TrainingType>('equipment_operation');
  const [reqDescription, setReqDescription] = useState('');
  const [reqNotes, setReqNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sesRes, reqRes, assetRes, catRes] = await Promise.all([
        getTrainingSessions(),
        getTrainingRequests(),
        getEquipmentList(),
        settingsService.getAll('equipment_categories'),
      ]);

      setSessions((sesRes.data || []) as SessionRow[]);
      setRequests((reqRes.data || []) as RequestRow[]);
      setAssets(
        (assetRes.data || []).map((a: Record<string, unknown>) => ({
          value: a.id as string,
          label: `${a.asset_code} — ${a.name}`,
        }))
      );
      setCategories(
        (catRes.data || []).map((c: Record<string, unknown>) => ({
          value: c.id as string,
          label: c.name as string,
        }))
      );
    } catch {
      toast('error', 'Failed to load training data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (searchParams.get('source') === 'requests-hub' && searchParams.get('action') === 'new-request') {
      setRequestModalOpen(true);
    }
  }, [searchParams]);

  const openDetail = async (session: SessionRow) => {
    setDetailSession(session);
    setAttendeesLoading(true);
    try {
      const { data } = await getStaffTrainingRecords(session.id as string);
      setAttendees((data || []) as AttendeeRow[]);
    } catch {
      toast('error', 'Failed to load attendees');
    } finally {
      setAttendeesLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!sesTitle || !sesTrainer || !sesDate) {
      toast('warning', 'Title, trainer, and date are required');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createTrainingSessionAction({
        title: sesTitle,
        asset_id: sesAssetId || null,
        category_id: sesCategoryId || null,
        trainer: sesTrainer,
        training_date: sesDate,
        duration_hours: sesDuration ? parseFloat(sesDuration) : null,
        location: sesLocation || null,
        description: sesDescription || null,
        max_participants: sesMaxParticipants ? parseInt(sesMaxParticipants) : null,
      });
      if (!result.success) throw new Error(result.error ?? 'Failed to create training session');
      toast('success', 'Training session created');
      setSessionModalOpen(false);
      resetSessionForm();
      loadData();
    } catch {
      toast('error', 'Failed to create training session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!reqDescription) {
      toast('warning', 'Description is required');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createTrainingRequestAction({
        asset_id: reqAssetId || null,
        requested_by: null,
        department_id: null,
        training_type: reqType,
        description: reqDescription,
        status: 'pending',
        notes: reqNotes || null,
      });
      if (!result.success) throw new Error(result.error ?? 'Failed to create training request');
      toast('success', 'Training request submitted');
      setRequestModalOpen(false);
      resetRequestForm();
      loadData();
    } catch {
      toast('error', 'Failed to create training request');
    } finally {
      setSubmitting(false);
    }
  };

  function scheduleFromRequest(row: RequestRow) {
    const asset = row.equipment_assets as { id?: string; asset_code?: string; name?: string } | null;
    setSesAssetId((row.asset_id as string | null) ?? asset?.id ?? '');
    setSesTitle(`${formatLabel(row.training_type as string)} - ${asset?.name ?? 'Training Session'}`);
    setSesDescription((row.description as string) || '');
    setSessionModalOpen(true);
  }

  const resetSessionForm = () => {
    setSesTitle(''); setSesAssetId(''); setSesCategoryId(''); setSesTrainer('');
    setSesDate(''); setSesDuration(''); setSesLocation(''); setSesDescription('');
    setSesMaxParticipants('');
  };

  const resetRequestForm = () => {
    setReqAssetId(''); setReqType('equipment_operation');
    setReqDescription(''); setReqNotes('');
  };

  const sessionColumns = [
    { key: 'title', header: 'Title', sortable: true },
    {
      key: 'asset_or_category',
      header: 'Asset / Category',
      render: (row: SessionRow) => {
        const asset = row.equipment_assets as { name: string } | null;
        const cat = row.equipment_categories as { name: string } | null;
        return asset?.name || cat?.name || '—';
      },
    },
    { key: 'trainer', header: 'Trainer', sortable: true },
    {
      key: 'training_date',
      header: 'Date',
      sortable: true,
      render: (row: SessionRow) => new Date(row.training_date as string).toLocaleDateString(),
    },
    {
      key: 'duration_hours',
      header: 'Duration',
      render: (row: SessionRow) =>
        row.duration_hours ? `${row.duration_hours}h` : '—',
    },
    {
      key: 'attendees',
      header: 'Attendees',
      render: () => (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"><Users className="h-4 w-4" /> Evidence</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row: SessionRow) => {
        const date = row.training_date ? new Date(row.training_date as string) : null;
        const label = date && date < new Date() ? 'Evidence' : 'Open';
        return (
          <button type="button" className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" onClick={() => openDetail(row)}>
            {label}
          </button>
        );
      },
    },
  ];

  const requestColumns = [
    { key: 'request_number', header: 'Request #', sortable: true },
    {
      key: 'training_type',
      header: 'Type',
      render: (row: RequestRow) => (
        <Badge variant="info">{formatLabel(row.training_type as string)}</Badge>
      ),
    },
    {
      key: 'asset',
      header: 'Asset',
      render: (row: RequestRow) => {
        const asset = row.equipment_assets as { name: string } | null;
        return asset?.name || '—';
      },
    },
    {
      key: 'description',
      header: 'Description',
      render: (row: RequestRow) => {
        const desc = row.description as string;
        return desc?.length > 60 ? `${desc.slice(0, 60)}...` : desc || '—';
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: RequestRow) => (
        <Badge variant={statusVariant[row.status as string] || 'default'}>
          {formatLabel(row.status as string)}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Requested',
      sortable: true,
      render: (row: RequestRow) => new Date(row.created_at as string).toLocaleDateString(),
    },
    {
      key: 'action',
      header: 'Next Action',
      render: (row: RequestRow) => {
        if (!canManageMaintenance) {
          return <Link className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" href={`/training?requestId=${row.id as string}`}>View</Link>;
        }
        if (row.status === 'pending') return <Link className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" href={`/training?requestId=${row.id as string}&action=review`}>Review</Link>;
        if (row.status === 'approved') {
          return <button type="button" className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" onClick={() => scheduleFromRequest(row)}>Schedule</button>;
        }
        if (row.status === 'completed') return <Link className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" href={`/training?requestId=${row.id as string}&action=evidence`}>Evidence</Link>;
        return <Link className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" href={`/training?requestId=${row.id as string}`}>View</Link>;
      },
    },
  ];

  const attendeeColumns = [
    { key: 'staff_name', header: 'Name', sortable: true },
    {
      key: 'status',
      header: 'Attendance',
      render: (row: AttendeeRow) => (
        <Badge variant={attendanceVariant[row.status as TrainingAttendance]}>
          {formatLabel(row.status as string)}
        </Badge>
      ),
    },
    {
      key: 'certification_date',
      header: 'Certified',
      render: (row: AttendeeRow) =>
        row.certification_date ? new Date(row.certification_date as string).toLocaleDateString() : '—',
    },
    { key: 'notes', header: 'Notes' },
  ];

  if (loading) return <PageLoader />;

  const now = new Date();
  const upcomingSessions = sessions.filter((row) => row.training_date && new Date(row.training_date as string) >= now);
  const completedThisMonth = sessions.filter((row) => {
    if (!row.training_date) return false;
    const date = new Date(row.training_date as string);
    return date < now && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const newEquipmentTraining = [...sessions, ...requests].filter((row) => row.asset_id).length;
  const userErrorRelated = requests.filter((row) => String(row.description ?? '').toLowerCase().match(/user error|operator|misuse|training/)).length;
  const departmentCoverage = new Set(requests.map((row) => (row.departments as { id?: string } | null)?.id ?? row.department_id).filter(Boolean)).size;
  const criticalEquipmentTraining = [...sessions, ...requests].filter((row) => row.asset_id).length;
  const categoryCoverageRows = categories.map((category) => {
    const sessionCount = sessions.filter((session) => session.category_id === category.value).length;
    const completed = sessions.filter((session) => session.category_id === category.value && session.training_date && new Date(session.training_date as string) < now).length;
    return {
      id: category.value,
      department: 'All departments',
      category: category.label,
      required: sessionCount > 0 ? 'Defined by completed sessions' : 'No required rule table',
      completed,
      coverage: sessionCount > 0 ? `${Math.round((completed / sessionCount) * 100)}%` : 'Not configured',
      gap: sessionCount > completed ? `${sessionCount - completed} upcoming/open` : sessionCount === 0 ? 'No session history' : 'Covered',
    };
  });
  const pendingRequests = requests.filter((row) => row.status === 'pending');
  const approvedRequests = requests.filter((row) => row.status === 'approved');
  const trainingQueue = [
    {
      label: 'Review requests',
      count: pendingRequests.length,
      why: 'Requests need BME review before a session is scheduled.',
      action: 'Requests',
      tab: 'requests',
    },
    {
      label: 'Schedule approved',
      count: approvedRequests.length,
      why: 'Approved competency needs should become real sessions.',
      action: 'Schedule',
      tab: 'requests',
    },
    {
      label: 'Coverage gaps',
      count: categoryCoverageRows.filter((row) => row.gap !== 'Covered').length,
      why: 'Coverage gaps show who needs training and why.',
      action: 'Coverage',
      tab: 'coverage',
    },
  ];

  if (detailSession) {
    return (
      <div>
        <div className="mb-4">
          <Button variant="ghost" onClick={() => setDetailSession(null)}>
            <ChevronLeft className="h-4 w-4" />
            Back to Sessions
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{detailSession.title as string}</CardTitle>
          </CardHeader>
          <div className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Trainer</span>
              <p className="font-medium">{detailSession.trainer as string}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Date</span>
              <p className="font-medium">{new Date(detailSession.training_date as string).toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Duration</span>
              <p className="font-medium">{detailSession.duration_hours ? `${detailSession.duration_hours}h` : '—'}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Location</span>
              <p className="font-medium">{(detailSession.location as string) || '—'}</p>
            </div>
          </div>
          {detailSession.description ? (
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{detailSession.description as string}</p>
          ) : null}
          <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Attendees</h4>
          <Table
            columns={attendeeColumns}
            data={attendees}
            loading={attendeesLoading}
            emptyMessage="No attendees recorded for this session"
          />
        </Card>
      </div>
    );
  }

  const tabs = [
    {
      id: 'sessions',
      label: 'Sessions',
      count: sessions.length,
      content: (
        <DataTable
          columns={sessionColumns}
          data={sessions}
          searchPlaceholder="Search sessions..."
          emptyMessage="No training sessions found"
          onRowClick={openDetail}
          actions={canManageMaintenance ? (
            <Button onClick={() => setSessionModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          ) : undefined}
        />
      ),
    },
    {
      id: 'requests',
      label: 'Requests',
      count: requests.length,
      content: (
        <DataTable
          columns={requestColumns}
          data={requests}
          searchPlaceholder="Search requests..."
          emptyMessage="No training requests found"
          actions={canManageMaintenance ? (
            <Button onClick={() => setRequestModalOpen(true)}>
              <ClipboardList className="h-4 w-4" />
              New Request
            </Button>
          ) : undefined}
        />
      ),
    },
    {
      id: 'upcoming',
      label: 'Upcoming',
      count: upcomingSessions.length,
      content: (
        <DataTable
          columns={sessionColumns}
          data={upcomingSessions}
          searchPlaceholder="Search upcoming sessions..."
          emptyMessage="No upcoming sessions scheduled"
          onRowClick={openDetail}
        />
      ),
    },
    {
      id: 'coverage',
      label: 'Coverage',
      count: categoryCoverageRows.length,
      content: (
        <Table
          columns={[
            { key: 'department', header: 'Department' },
            { key: 'category', header: 'Equipment Category' },
            { key: 'required', header: 'Required Training' },
            { key: 'completed', header: 'Completed Training' },
            { key: 'coverage', header: 'Coverage %' },
            { key: 'gap', header: 'Gap' },
            {
              key: 'action',
              header: 'Action',
              render: (row: Record<string, unknown>) => canManageMaintenance ? (
                <button type="button" className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]" onClick={() => { setSesCategoryId(row.id as string); setRequestModalOpen(true); }}>
                  Create Training Request
                </button>
              ) : 'View',
            },
          ]}
          data={categoryCoverageRows}
          emptyMessage="No training coverage rows found"
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training"
        description="Competency and equipment safety workflow for requests, scheduled sessions, attendance evidence, and coverage gaps."
        actions={canManageMaintenance ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRequestModalOpen(true)}><ClipboardList className="h-4 w-4" /> New Request</Button>
            <Button onClick={() => setSessionModalOpen(true)}><Plus className="h-4 w-4" /> New Session</Button>
          </div>
        ) : <Badge variant="info">{primaryRole === 'viewer' ? 'Read-only' : 'View access'}</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Training Sessions" value={sessions.length} icon={<GraduationCap className="h-6 w-6" />} color="blue" />
        <StatCard label="Pending Requests" value={pendingRequests.length} icon={<ClipboardList className="h-6 w-6" />} color="yellow" />
        <StatCard label="Upcoming Sessions" value={upcomingSessions.length} icon={<CalendarClock className="h-6 w-6" />} color="purple" />
        <StatCard label="Completed This Month" value={completedThisMonth.length} icon={<CheckCircle className="h-6 w-6" />} color="green" />
        <StatCard label="New Equipment Training" value={newEquipmentTraining} icon={<GraduationCap className="h-6 w-6" />} color="orange" />
        <StatCard label="User Error Related" value={userErrorRelated} icon={<ShieldAlert className="h-6 w-6" />} color="red" />
        <StatCard label="Department Coverage" value={departmentCoverage} icon={<Users className="h-6 w-6" />} color="blue" />
        <StatCard label="Critical Equipment Training" value={criticalEquipmentTraining} icon={<ShieldAlert className="h-6 w-6" />} color="purple" />
      </div>

      <section className="panel-surface rounded-lg p-4">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Training Work Queue</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Training should answer who needs competency support, why it matters, and what evidence closes the gap.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {trainingQueue.map((item) => (
            <div key={item.label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
                <span className="text-2xl font-bold text-[var(--foreground)]">{item.count}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{item.why}</p>
            </div>
          ))}
        </div>
      </section>

      <Tabs tabs={tabs} defaultTab={pendingRequests.length > 0 ? 'requests' : 'sessions'} />

      {/* New Session Modal */}
      <Modal
        open={sessionModalOpen}
        onClose={() => { setSessionModalOpen(false); resetSessionForm(); }}
        title="New Training Session"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setSessionModalOpen(false); resetSessionForm(); }}>Cancel</Button>
            <Button onClick={handleCreateSession} loading={submitting}>Create Session</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Title *" value={sesTitle} onChange={(e) => setSesTitle(e.target.value)} placeholder="Training session title" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Asset" options={assets} placeholder="Select asset (optional)" value={sesAssetId} onChange={(e) => setSesAssetId(e.target.value)} />
            <Select label="Category" options={categories} placeholder="Select category (optional)" value={sesCategoryId} onChange={(e) => setSesCategoryId(e.target.value)} />
          </div>
          <Input label="Trainer *" value={sesTrainer} onChange={(e) => setSesTrainer(e.target.value)} placeholder="Trainer name" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Date *" type="date" value={sesDate} onChange={(e) => setSesDate(e.target.value)} />
            <Input label="Duration (hours)" type="number" step="0.5" value={sesDuration} onChange={(e) => setSesDuration(e.target.value)} />
            <Input label="Max Participants" type="number" value={sesMaxParticipants} onChange={(e) => setSesMaxParticipants(e.target.value)} />
          </div>
          <Input label="Location" value={sesLocation} onChange={(e) => setSesLocation(e.target.value)} placeholder="Training location" />
          <Textarea label="Description" value={sesDescription} onChange={(e) => setSesDescription(e.target.value)} placeholder="Session description..." />
        </div>
      </Modal>

      {/* New Request Modal */}
      <Modal
        open={requestModalOpen}
        onClose={() => { setRequestModalOpen(false); resetRequestForm(); }}
        title="New Training Request"
        footer={
          <>
            <Button variant="outline" onClick={() => { setRequestModalOpen(false); resetRequestForm(); }}>Cancel</Button>
            <Button onClick={handleCreateRequest} loading={submitting}>Submit Request</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Training Type" options={trainingTypeOptions} value={reqType} onChange={(e) => setReqType(e.target.value as TrainingType)} />
          <Select label="Asset (optional)" options={assets} placeholder="Select asset" value={reqAssetId} onChange={(e) => setReqAssetId(e.target.value)} />
          <Textarea label="Description *" value={reqDescription} onChange={(e) => setReqDescription(e.target.value)} placeholder="Describe the training needed..." />
          <Textarea label="Notes" value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} placeholder="Additional notes..." />
        </div>
      </Modal>
    </div>
  );
}
