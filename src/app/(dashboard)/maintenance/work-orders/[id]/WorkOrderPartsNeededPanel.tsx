'use client';

// R19: Parts Needed panel mounted into the WO detail page.
//
// Surfaces parts a technician has declared as needed for an open work order
// and lets them declare new ones, mark them fulfilled when stock is issued,
// or cancel them when the need goes away.
//
// Read-only branches for viewer / department roles — only technician /
// admin / bme_head get the declare/transition buttons. The server action
// gates re-validate this regardless.

import { useCallback, useEffect, useState } from 'react';
import { Plus, CheckCircle, XCircle, PackageMinus } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Modal, Input, Select, Textarea, Badge,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import {
  declareWorkOrderPartNeededAction,
  updateWorkOrderPartNeededStatusAction,
} from '@/actions/maintenance.actions';
import { getWorkOrderPartsNeeded } from '@/services/maintenance.service';
import { getSpareParts } from '@/services/spare-parts.service';

interface PartNeededRow {
  id: string;
  work_order_id: string;
  spare_part_id: string;
  quantity_needed: number;
  notes: string | null;
  status: 'open' | 'fulfilled' | 'canceled';
  created_at: string;
  fulfilled_at: string | null;
  canceled_at: string | null;
  spare_parts?: {
    id: string;
    part_code: string;
    name: string;
    current_stock: number | null;
    reorder_level: number | null;
  } | null;
  profiles?: { id: string; full_name: string | null } | null;
}

interface SparePartOption {
  id: string;
  part_code: string;
  name: string;
  current_stock: number | null;
  reorder_level: number | null;
}

interface Props {
  workOrderId: string;
  workOrderStatus: string;
}

export default function WorkOrderPartsNeededPanel({ workOrderId, workOrderStatus }: Props) {
  const { roles: roleNames } = useRole();
  const { toast } = useToast();
  const [rows, setRows] = useState<PartNeededRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [allParts, setAllParts] = useState<SparePartOption[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantityNeeded, setQuantityNeeded] = useState('1');
  const [notes, setNotes] = useState('');

  const isTerminal = ['completed', 'canceled'].includes(workOrderStatus);
  const canDeclare = !isTerminal && roleNames.some((r: string) =>
    ['developer', 'admin', 'bme_head', 'technician'].includes(r),
  );
  const canFulfill = roleNames.some((r: string) =>
    ['developer', 'admin', 'bme_head', 'technician', 'store_user'].includes(r),
  );

  const load = useCallback(async () => {
    const { data, error } = await getWorkOrderPartsNeeded(workOrderId);
    if (error) {
      toast('error', `Failed to load parts needed: ${error.message}`);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as unknown as PartNeededRow[]);
    setLoading(false);
  }, [workOrderId, toast]);

  useEffect(() => {
    // Defer the initial load onto a microtask so the lint rule that forbids
    // synchronous setState in effects is satisfied (load eventually calls
    // setRows/setLoading inside its async body).
    let canceled = false;
    void Promise.resolve().then(async () => {
      if (canceled) return;
      await load();
    });
    return () => { canceled = true; };
  }, [load]);

  async function openDeclareModal() {
    setSelectedPartId('');
    setQuantityNeeded('1');
    setNotes('');
    if (allParts.length === 0) {
      const { data, error } = await getSpareParts({});
      if (error) {
        toast('error', `Failed to load spare parts: ${error.message}`);
        return;
      }
      setAllParts((data ?? []) as unknown as SparePartOption[]);
    }
    setModalOpen(true);
  }

  async function handleDeclare() {
    if (!selectedPartId) {
      toast('warning', 'Please select a part');
      return;
    }
    const qty = Number(quantityNeeded);
    if (!Number.isFinite(qty) || qty < 1) {
      toast('warning', 'Quantity must be at least 1');
      return;
    }
    setActionLoading(true);
    const result = await declareWorkOrderPartNeededAction({
      work_order_id: workOrderId,
      spare_part_id: selectedPartId,
      quantity_needed: qty,
      notes: notes.trim() || null,
    });
    setActionLoading(false);
    if (!result.success) {
      toast('error', result.error ?? 'Failed to declare part need');
      return;
    }
    toast('success', 'Part declared as needed');
    setModalOpen(false);
    await load();
  }

  async function handleTransition(id: string, status: 'fulfilled' | 'canceled') {
    setActionLoading(true);
    const result = await updateWorkOrderPartNeededStatusAction(id, status);
    setActionLoading(false);
    if (!result.success) {
      toast('error', result.error ?? `Failed to mark part need ${status}`);
      return;
    }
    toast('success', `Part need ${status}`);
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <PackageMinus className="h-4 w-4 text-[var(--text-muted)]" />
              Parts Needed (R19)
            </span>
          </CardTitle>
          {canDeclare ? (
            <Button size="sm" onClick={openDeclareModal}>
              <Plus className="h-4 w-4" />
              Declare part needed
            </Button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Declared needs power the Command Center stock-blocker signal. Open needs on
          low/zero-stock parts surface this work order as blocked.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {canDeclare
              ? 'No parts have been declared as needed for this work order.'
              : 'No parts have been declared as needed for this work order yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const stock = row.spare_parts?.current_stock ?? 0;
              const reorder = row.spare_parts?.reorder_level ?? 0;
              const isStockedOut = stock <= 0;
              const isLow = !isStockedOut && stock <= reorder;
              return (
                <li
                  key={row.id}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {row.spare_parts?.name ?? '(unknown part)'}{' '}
                        <span className="text-xs text-[var(--text-muted)]">
                          {row.spare_parts?.part_code ?? ''}
                        </span>
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Needed: <strong>{row.quantity_needed}</strong>
                        {' • '}On hand: <strong>{stock}</strong>
                        {' • '}Reorder level: <strong>{reorder}</strong>
                      </p>
                      {row.notes ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Note: {row.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {row.status === 'open' ? (
                        isStockedOut ? <Badge variant="error">Stockout</Badge>
                          : isLow ? <Badge variant="warning">Low stock</Badge>
                          : <Badge variant="info">Open</Badge>
                      ) : row.status === 'fulfilled' ? (
                        <Badge variant="success">Fulfilled</Badge>
                      ) : (
                        <Badge variant="default">Canceled</Badge>
                      )}
                      {row.status === 'open' && canFulfill ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTransition(row.id, 'fulfilled')}
                            loading={actionLoading}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Mark fulfilled
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTransition(row.id, 'canceled')}
                            loading={actionLoading}
                          >
                            <XCircle className="h-4 w-4" />
                            Cancel
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Declare part needed"
          footer={
            <>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleDeclare} loading={actionLoading}>Declare</Button>
            </>
          }
        >
          <div className="space-y-3">
            <Select
              label="Spare part *"
              value={selectedPartId}
              onChange={(e) => setSelectedPartId(e.target.value)}
              options={[
                { value: '', label: '— Select a part —' },
                ...allParts.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.part_code}) — on hand ${p.current_stock ?? 0}`,
                })),
              ]}
            />
            <Input
              type="number"
              min="1"
              label="Quantity needed *"
              value={quantityNeeded}
              onChange={(e) => setQuantityNeeded(e.target.value)}
            />
            <Textarea
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. needed before re-energizing the equipment"
            />
            <p className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
              An open need is unique per (work order, part). If you&apos;ve already declared the
              same part, the existing need is reused.
            </p>
          </div>
        </Modal>
      </CardContent>
    </Card>
  );
}
