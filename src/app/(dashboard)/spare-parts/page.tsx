'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, PackagePlus, PackageMinus, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Table from '@/components/ui/Table';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  getSpareParts,
  createSparePart,
  createStockReceipt,
  createStockIssue,
  getLowStockParts,
} from '@/services/spare-parts.service';
import { createClient } from '@/lib/supabase/client';
import type { SparePart } from '@/types/database';

type PartRow = Record<string, unknown>;
type ReceiptRow = Record<string, unknown>;
type IssueRow = Record<string, unknown>;
type LowStockRow = Record<string, unknown>;

export default function SparePartsPage() {
  const { toast } = useToast();
  const [parts, setParts] = useState<PartRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [addPartOpen, setAddPartOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);

  // Add Part form
  const [partCode, setPartCode] = useState('');
  const [partName, setPartName] = useState('');
  const [partCategory, setPartCategory] = useState('');
  const [partUnit, setPartUnit] = useState('pcs');
  const [partReorderLevel, setPartReorderLevel] = useState('');
  const [partUnitCost, setPartUnitCost] = useState('');

  // Receipt form
  const [recPartId, setRecPartId] = useState('');
  const [recQuantity, setRecQuantity] = useState('');
  const [recSupplier, setRecSupplier] = useState('');
  const [recInvoice, setRecInvoice] = useState('');
  const [recUnitCost, setRecUnitCost] = useState('');
  const [recNotes, setRecNotes] = useState('');

  // Issue form
  const [issPartId, setIssPartId] = useState('');
  const [issQuantity, setIssQuantity] = useState('');
  const [issDepartment, setIssDepartment] = useState('');
  const [issNotes, setIssNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [partsRes, receiptsRes, issuesRes, lowRes] = await Promise.all([
        getSpareParts(),
        supabase
          .from('stock_receipts')
          .select('id, part_id, quantity, received_by, received_date, supplier_id, invoice_ref, unit_cost, notes, created_at, spare_parts(id, part_code, name)')
          .order('received_date', { ascending: false }),
        supabase
          .from('stock_issues')
          .select('id, part_id, quantity, issued_to_event_id, issued_by, issue_date, department_id, notes, created_at, spare_parts(id, part_code, name), departments(id, name)')
          .order('issue_date', { ascending: false }),
        getLowStockParts(),
      ]);

      setParts((partsRes.data || []) as PartRow[]);
      setReceipts((receiptsRes.data || []) as ReceiptRow[]);
      setIssues((issuesRes.data || []) as IssueRow[]);
      setLowStock((lowRes.data || []) as LowStockRow[]);
    } catch {
      toast('error', 'Failed to load spare parts data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddPart = async () => {
    if (!partCode || !partName) {
      toast('warning', 'Part code and name are required');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await createSparePart({
        part_code: partCode,
        name: partName,
        description: null,
        category: partCategory || null,
        unit: partUnit,
        reorder_level: parseInt(partReorderLevel) || 0,
        current_stock: 0,
        unit_cost: partUnitCost ? parseFloat(partUnitCost) : null,
        compatible_categories: [],
        is_active: true,
      });
      if (error) throw error;
      toast('success', 'Spare part added');
      setAddPartOpen(false);
      resetPartForm();
      loadData();
    } catch {
      toast('error', 'Failed to add spare part');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceipt = async () => {
    if (!recPartId || !recQuantity) {
      toast('warning', 'Part and quantity are required');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await createStockReceipt({
        part_id: recPartId,
        quantity: parseInt(recQuantity),
        received_by: null,
        received_date: new Date().toISOString().split('T')[0],
        supplier_id: recSupplier || null,
        invoice_ref: recInvoice || null,
        unit_cost: recUnitCost ? parseFloat(recUnitCost) : null,
        notes: recNotes || null,
      });
      if (error) throw error;
      toast('success', 'Stock receipt recorded');
      setReceiptOpen(false);
      resetReceiptForm();
      loadData();
    } catch {
      toast('error', 'Failed to record receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssue = async () => {
    if (!issPartId || !issQuantity) {
      toast('warning', 'Part and quantity are required');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await createStockIssue({
        part_id: issPartId,
        quantity: parseInt(issQuantity),
        issued_to_event_id: null,
        issued_by: null,
        issue_date: new Date().toISOString().split('T')[0],
        department_id: issDepartment || null,
        notes: issNotes || null,
      });
      if (error) throw error;
      toast('success', 'Stock issue recorded');
      setIssueOpen(false);
      resetIssueForm();
      loadData();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to record issue';
      toast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetPartForm = () => {
    setPartCode(''); setPartName(''); setPartCategory(''); setPartUnit('pcs');
    setPartReorderLevel(''); setPartUnitCost('');
  };
  const resetReceiptForm = () => {
    setRecPartId(''); setRecQuantity(''); setRecSupplier(''); setRecInvoice('');
    setRecUnitCost(''); setRecNotes('');
  };
  const resetIssueForm = () => {
    setIssPartId(''); setIssQuantity(''); setIssDepartment(''); setIssNotes('');
  };

  const partOptions = parts.map((p) => ({
    value: p.id as string,
    label: `${p.part_code} — ${p.name}`,
  }));

  const catalogColumns = [
    { key: 'part_code', header: 'Part Code', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'category', header: 'Category', sortable: true },
    {
      key: 'current_stock',
      header: 'Stock',
      sortable: true,
      render: (row: PartRow) => {
        const stock = row.current_stock as number;
        const reorder = row.reorder_level as number;
        const isLow = stock <= reorder;
        return (
          <span className={isLow ? 'font-semibold text-red-600' : ''}>
            {stock}
            {isLow && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}
          </span>
        );
      },
    },
    {
      key: 'reorder_level',
      header: 'Reorder Level',
    },
    {
      key: 'unit_cost',
      header: 'Unit Cost',
      render: (row: PartRow) =>
        row.unit_cost != null ? `$${(row.unit_cost as number).toFixed(2)}` : '—',
    },
  ];

  const receiptColumns = [
    {
      key: 'part_name',
      header: 'Part',
      render: (row: ReceiptRow) => {
        const part = row.spare_parts as { part_code: string; name: string } | null;
        return part ? `${part.part_code} — ${part.name}` : '—';
      },
    },
    { key: 'quantity', header: 'Quantity', sortable: true },
    { key: 'invoice_ref', header: 'Invoice Ref' },
    {
      key: 'unit_cost',
      header: 'Unit Cost',
      render: (row: ReceiptRow) =>
        row.unit_cost != null ? `$${(row.unit_cost as number).toFixed(2)}` : '—',
    },
    {
      key: 'received_date',
      header: 'Date',
      sortable: true,
      render: (row: ReceiptRow) => new Date(row.received_date as string).toLocaleDateString(),
    },
  ];

  const issueColumns = [
    {
      key: 'part_name',
      header: 'Part',
      render: (row: IssueRow) => {
        const part = row.spare_parts as { part_code: string; name: string } | null;
        return part ? `${part.part_code} — ${part.name}` : '—';
      },
    },
    { key: 'quantity', header: 'Quantity', sortable: true },
    {
      key: 'department',
      header: 'Issued To',
      render: (row: IssueRow) => {
        const dept = row.departments as { name: string } | null;
        return dept?.name || '—';
      },
    },
    {
      key: 'issue_date',
      header: 'Date',
      sortable: true,
      render: (row: IssueRow) => new Date(row.issue_date as string).toLocaleDateString(),
    },
  ];

  const lowStockColumns = [
    { key: 'part_code', header: 'Part Code', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'category', header: 'Category' },
    {
      key: 'current_stock',
      header: 'Current Stock',
      render: (row: LowStockRow) => (
        <span className="font-semibold text-red-600">{row.current_stock as number}</span>
      ),
    },
    { key: 'reorder_level', header: 'Reorder Level' },
    {
      key: 'deficit',
      header: 'Deficit',
      render: (row: LowStockRow) => (
        <Badge variant="error">{row.deficit as number}</Badge>
      ),
    },
    {
      key: 'unit_cost',
      header: 'Unit Cost',
      render: (row: LowStockRow) =>
        row.unit_cost != null ? `$${(row.unit_cost as number).toFixed(2)}` : '—',
    },
  ];

  if (loading) return <PageLoader />;

  const tabs = [
    {
      id: 'catalog',
      label: 'Catalog',
      count: parts.length,
      content: (
        <DataTable
          columns={catalogColumns}
          data={parts}
          searchPlaceholder="Search parts..."
          emptyMessage="No spare parts in catalog"
          actions={
            <Button onClick={() => setAddPartOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Part
            </Button>
          }
        />
      ),
    },
    {
      id: 'receipts',
      label: 'Receipts',
      count: receipts.length,
      content: (
        <DataTable
          columns={receiptColumns}
          data={receipts}
          searchPlaceholder="Search receipts..."
          emptyMessage="No stock receipts recorded"
          actions={
            <Button onClick={() => setReceiptOpen(true)}>
              <PackagePlus className="h-4 w-4" />
              Record Receipt
            </Button>
          }
        />
      ),
    },
    {
      id: 'issues',
      label: 'Issues',
      count: issues.length,
      content: (
        <DataTable
          columns={issueColumns}
          data={issues}
          searchPlaceholder="Search issues..."
          emptyMessage="No stock issues recorded"
          actions={
            <Button onClick={() => setIssueOpen(true)}>
              <PackageMinus className="h-4 w-4" />
              Record Issue
            </Button>
          }
        />
      ),
    },
    {
      id: 'lowstock',
      label: 'Low Stock',
      count: lowStock.length,
      content: (
        <Table
          columns={lowStockColumns}
          data={lowStock}
          emptyMessage="All parts are above reorder level"
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Spare Parts Management"
        description="Manage spare parts catalog, stock receipts, issues, and low-stock alerts"
      />

      <Tabs tabs={tabs} />

      {/* Add Part Modal */}
      <Modal
        open={addPartOpen}
        onClose={() => { setAddPartOpen(false); resetPartForm(); }}
        title="Add Spare Part"
        footer={
          <>
            <Button variant="outline" onClick={() => { setAddPartOpen(false); resetPartForm(); }}>Cancel</Button>
            <Button onClick={handleAddPart} loading={submitting}>Add Part</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Part Code *" value={partCode} onChange={(e) => setPartCode(e.target.value)} placeholder="e.g. SP-001" />
            <Input label="Name *" value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="Part name" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Category" value={partCategory} onChange={(e) => setPartCategory(e.target.value)} placeholder="e.g. Filters" />
            <Input label="Unit" value={partUnit} onChange={(e) => setPartUnit(e.target.value)} placeholder="e.g. pcs, m, kg" />
            <Input label="Unit Cost ($)" type="number" step="0.01" value={partUnitCost} onChange={(e) => setPartUnitCost(e.target.value)} />
          </div>
          <Input label="Reorder Level" type="number" value={partReorderLevel} onChange={(e) => setPartReorderLevel(e.target.value)} placeholder="Minimum stock threshold" />
        </div>
      </Modal>

      {/* Record Receipt Modal */}
      <Modal
        open={receiptOpen}
        onClose={() => { setReceiptOpen(false); resetReceiptForm(); }}
        title="Record Stock Receipt"
        footer={
          <>
            <Button variant="outline" onClick={() => { setReceiptOpen(false); resetReceiptForm(); }}>Cancel</Button>
            <Button onClick={handleReceipt} loading={submitting}>Record Receipt</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Part *" options={partOptions} placeholder="Select part" value={recPartId} onChange={(e) => setRecPartId(e.target.value)} />
          <Input label="Quantity *" type="number" value={recQuantity} onChange={(e) => setRecQuantity(e.target.value)} />
          <Input label="Invoice Reference" value={recInvoice} onChange={(e) => setRecInvoice(e.target.value)} />
          <Input label="Unit Cost ($)" type="number" step="0.01" value={recUnitCost} onChange={(e) => setRecUnitCost(e.target.value)} />
          <Textarea label="Notes" value={recNotes} onChange={(e) => setRecNotes(e.target.value)} />
        </div>
      </Modal>

      {/* Record Issue Modal */}
      <Modal
        open={issueOpen}
        onClose={() => { setIssueOpen(false); resetIssueForm(); }}
        title="Record Stock Issue"
        footer={
          <>
            <Button variant="outline" onClick={() => { setIssueOpen(false); resetIssueForm(); }}>Cancel</Button>
            <Button onClick={handleIssue} loading={submitting}>Record Issue</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Part *" options={partOptions} placeholder="Select part" value={issPartId} onChange={(e) => setIssPartId(e.target.value)} />
          <Input label="Quantity *" type="number" value={issQuantity} onChange={(e) => setIssQuantity(e.target.value)} />
          <Input label="Department" value={issDepartment} onChange={(e) => setIssDepartment(e.target.value)} placeholder="Department or purpose" />
          <Textarea label="Notes" value={issNotes} onChange={(e) => setIssNotes(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
