import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HOSPITAL_NAME } from '@/constants';

export interface ExportColumn<T extends Record<string, unknown>> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

function reactNodeToText(value: React.ReactNode): string {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(reactNodeToText).filter(Boolean).join(' ');
  if (typeof value === 'object' && 'props' in value) {
    const props = (value as { props?: { children?: React.ReactNode } }).props;
    return reactNodeToText(props?.children);
  }
  return '';
}

function cellValue<T extends Record<string, unknown>>(row: T, column: ExportColumn<T>): string {
  if (column.render) {
    const rendered = reactNodeToText(column.render(row));
    if (rendered) return rendered;
  }

  const val = row[column.key];
  if (val == null) return '';
  if (val instanceof Date) return val.toLocaleString();
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/** Pattern: bmerms-[slug]-snapshot-YYYY-MM-DD-HH-mm */
function datedFilename(slug: string, extension: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `bmerms-${slug}-snapshot-${date}-${hh}-${mm}.${extension}`;
}

function escapeCsv(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvMetadata {
  reportTitle?: string;
  generatedAt?: string;
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  slug: string,
  meta: CsvMetadata = {}
): { success: boolean; error?: string } {
  if (data.length === 0) return { success: false, error: 'No rows to export' };

  const generatedAt = meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : new Date().toLocaleString();
  const reportTitle = meta.reportTitle ?? slug;

  // Metadata header rows
  const metaRows = [
    `Report,${escapeCsv(reportTitle)}`,
    `Institution,${escapeCsv(HOSPITAL_NAME)}`,
    `Snapshot Generated,${escapeCsv(generatedAt)}`,
    `Source,BMERMS operational database`,
    ``,
  ];

  const headers = columns.map((c) => escapeCsv(c.header));
  const dataRows = data.map((row) => columns.map((c) => escapeCsv(cellValue(row, c))));

  const csv = [...metaRows, headers.join(','), ...dataRows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', datedFilename(slug, 'csv'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { success: true };
}

export function exportToPDF<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  title,
  filters = {},
  generatedAt,
}: {
  data: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title: string;
  filters?: Record<string, string>;
  generatedAt?: string;
}): { success: boolean; error?: string } {
  if (data.length === 0) return { success: false, error: 'No rows to export' };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const snapshotTs = generatedAt ? new Date(generatedAt).toLocaleString() : new Date().toLocaleString();
  const activeFilters = Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(' | ');

  doc.setFontSize(14);
  doc.text(HOSPITAL_NAME, 40, 40);
  doc.setFontSize(12);
  doc.text(title, 40, 60);
  doc.setFontSize(9);
  doc.text(`Snapshot Generated: ${snapshotTs}`, 40, 78);
  doc.text(`Source: BMERMS operational database`, 40, 92);
  if (activeFilters) {
    doc.text(`Filters: ${activeFilters}`, 40, 106, { maxWidth: 760 });
  }

  const startY = activeFilters ? 124 : 110;

  autoTable(doc, {
    head: [columns.map((column) => column.header)],
    body: data.map((row) => columns.map((column) => cellValue(row, column))),
    startY,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 41, 55] },
    margin: { left: 40, right: 40 },
  });

  doc.save(datedFilename(filename, 'pdf'));
  return { success: true };
}

/**
 * Trigger browser print dialog (user can save as PDF from here).
 */
export function printPage(): void {
  window.print();
}
