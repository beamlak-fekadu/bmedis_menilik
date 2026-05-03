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

function datedFilename(filename: string, extension: string): string {
  return `${filename}_${new Date().toISOString().split('T')[0]}.${extension}`;
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  if (data.length === 0) return;

  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((c) => {
      const str = cellValue(row, c);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    })
  );

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', datedFilename(filename, 'csv'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPDF<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  title,
  filters = {},
}: {
  data: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title: string;
  filters?: Record<string, string>;
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const generatedAt = new Date().toLocaleString();
  const activeFilters = Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(' | ');

  doc.setFontSize(14);
  doc.text(HOSPITAL_NAME, 40, 40);
  doc.setFontSize(12);
  doc.text(title, 40, 60);
  doc.setFontSize(9);
  doc.text(`Generated: ${generatedAt}`, 40, 78);
  if (activeFilters) {
    doc.text(`Filters: ${activeFilters}`, 40, 94, { maxWidth: 760 });
  }

  autoTable(doc, {
    head: [columns.map((column) => column.header)],
    body: data.map((row) => columns.map((column) => cellValue(row, column))),
    startY: activeFilters ? 112 : 96,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 41, 55] },
    margin: { left: 40, right: 40 },
  });

  doc.save(datedFilename(filename, 'pdf'));
}

/**
 * Print the current page.
 */
export function printPage(): void {
  window.print();
}
