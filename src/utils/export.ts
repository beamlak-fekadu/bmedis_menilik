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

export interface PdfChartImage {
  title: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface PdfKpi {
  label: string;
  value: string | number;
  sub?: string;
}

export interface PdfFinding {
  severity: 'critical' | 'warning' | 'info';
  finding: string;
}

export interface PdfChartSummary {
  title: string;
  description?: string;
  labels?: readonly string[];
}

export interface ExportPdfOptions<T extends Record<string, unknown>> {
  data: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title: string;
  filters?: Record<string, string>;
  generatedAt?: string;
  executiveSummary?: string;
  kpis?: PdfKpi[];
  charts?: PdfChartImage[];
  // Chart titles/labels expected on the page. Used when zero `charts` were
  // captured so the PDF still names what should have been there.
  chartSummaries?: PdfChartSummary[];
  // Optional note shown in the Visual Analytics section when chart images
  // could not be embedded (e.g. tainted canvas, no canvases on page).
  chartExportNote?: string;
  priorityFindings?: PdfFinding[];
  methodologyNote?: string;
}

const PAGE_MARGIN = 40;
const FOOTER_RESERVE = 24;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - FOOTER_RESERVE) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return y;
}

function drawWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 12): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function addFooterPageNumbers(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`${HOSPITAL_NAME} — BMERMS`, PAGE_MARGIN, pageHeight - 12);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 12, { align: 'right' });
    doc.setTextColor(0);
  }
}

export function exportToPDF<T extends Record<string, unknown>>(opts: ExportPdfOptions<T>): { success: boolean; error?: string } {
  const {
    data,
    columns,
    filename,
    title,
    filters = {},
    generatedAt,
    executiveSummary,
    kpis,
    charts,
    chartSummaries,
    chartExportNote,
    priorityFindings,
    methodologyNote,
  } = opts;

  const hasData = data.length > 0;
  const hasNarrative = Boolean(
    executiveSummary ||
      (kpis && kpis.length) ||
      (charts && charts.length) ||
      (chartSummaries && chartSummaries.length) ||
      chartExportNote ||
      (priorityFindings && priorityFindings.length) ||
      methodologyNote
  );
  if (!hasData && !hasNarrative) return { success: false, error: 'No content to export' };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const snapshotTs = generatedAt ? new Date(generatedAt).toLocaleString() : new Date().toLocaleString();
  const activeFilters = Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(' | ');

  let y = PAGE_MARGIN;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, PAGE_MARGIN, y);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`${HOSPITAL_NAME} — Biomedical Equipment Resource Management System`, PAGE_MARGIN, y);
  y += 14;
  doc.text(`Snapshot Generated: ${snapshotTs}`, PAGE_MARGIN, y);
  y += 12;
  doc.text(`Source: BMERMS operational database`, PAGE_MARGIN, y);
  y += 12;
  if (activeFilters) {
    y = drawWrappedText(doc, `Filters: ${activeFilters}`, PAGE_MARGIN, y, contentWidth, 12);
  }
  doc.setTextColor(0);

  const sectionHeader = (label: string) => {
    y = ensureSpace(doc, y + 6, 24);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(label, PAGE_MARGIN, y);
    y += 6;
    doc.setDrawColor(180);
    doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  if (executiveSummary) {
    sectionHeader('Executive Summary');
    doc.setTextColor(40);
    y = drawWrappedText(doc, executiveSummary, PAGE_MARGIN, y, contentWidth, 13);
    doc.setTextColor(0);
  }

  if (kpis && kpis.length > 0) {
    sectionHeader('Key Performance Indicators');
    const cols = Math.min(4, kpis.length);
    const cellWidth = (contentWidth - (cols - 1) * 8) / cols;
    const cellHeight = 56;
    let col = 0;
    let rowY = ensureSpace(doc, y, cellHeight);
    for (const kpi of kpis) {
      const x = PAGE_MARGIN + col * (cellWidth + 8);
      doc.setDrawColor(200);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, rowY, cellWidth, cellHeight, 4, 4, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(String(kpi.label), x + 8, rowY + 14);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20);
      doc.text(String(kpi.value), x + 8, rowY + 34);
      doc.setFont('helvetica', 'normal');
      if (kpi.sub) {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(String(kpi.sub), x + 8, rowY + 48, { maxWidth: cellWidth - 16 });
      }
      doc.setTextColor(0);
      col++;
      if (col >= cols) {
        col = 0;
        rowY += cellHeight + 8;
        rowY = ensureSpace(doc, rowY, cellHeight);
      }
    }
    y = col === 0 ? rowY : rowY + cellHeight + 8;
  }

  const hasChartImages = Boolean(charts && charts.length > 0);
  const hasChartFallback = !hasChartImages && Boolean(
    (chartSummaries && chartSummaries.length > 0) || chartExportNote
  );
  if (hasChartImages) {
    sectionHeader('Visual Analytics');
    const safeCharts = charts as PdfChartImage[];
    const chartCols = safeCharts.length === 1 ? 1 : 2;
    const slotWidth = (contentWidth - (chartCols - 1) * 12) / chartCols;
    const maxImgHeight = 220;
    let col = 0;
    let rowTop = ensureSpace(doc, y, maxImgHeight + 28);
    for (let i = 0; i < safeCharts.length; i++) {
      const chart = safeCharts[i];
      const aspect = chart.height > 0 ? chart.width / chart.height : 16 / 9;
      let imgWidth = slotWidth;
      let imgHeight = imgWidth / aspect;
      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight;
        imgWidth = imgHeight * aspect;
      }
      const x = PAGE_MARGIN + col * (slotWidth + 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(chart.title, x, rowTop);
      doc.setFont('helvetica', 'normal');
      try {
        doc.addImage(chart.dataUrl, 'PNG', x, rowTop + 6, imgWidth, imgHeight);
      } catch {
        doc.setFontSize(9);
        doc.setTextColor(160);
        doc.text('Chart image could not be embedded.', x, rowTop + 20);
        doc.setTextColor(0);
      }
      col++;
      if (col >= chartCols) {
        col = 0;
        rowTop += maxImgHeight + 28;
        if (i < safeCharts.length - 1) {
          rowTop = ensureSpace(doc, rowTop, maxImgHeight + 28);
        }
      }
    }
    y = col === 0 ? rowTop : rowTop + maxImgHeight + 28;
  } else if (hasChartFallback) {
    sectionHeader('Visual Analytics');
    const note = chartExportNote
      ?? 'Chart images could not be captured for this snapshot. The visual summary below lists the charts that appear on the on-screen report.';
    doc.setTextColor(120);
    y = drawWrappedText(doc, note, PAGE_MARGIN, y, contentWidth, 13);
    doc.setTextColor(0);
    if (chartSummaries && chartSummaries.length > 0) {
      y += 4;
      for (const summary of chartSummaries) {
        y = ensureSpace(doc, y, 14);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`• ${summary.title}`, PAGE_MARGIN, y);
        doc.setFont('helvetica', 'normal');
        y += 12;
        if (summary.description) {
          doc.setTextColor(90);
          y = drawWrappedText(doc, summary.description, PAGE_MARGIN + 12, y, contentWidth - 12, 12);
          doc.setTextColor(0);
        }
        if (summary.labels && summary.labels.length > 0) {
          doc.setTextColor(110);
          const preview = summary.labels.slice(0, 8).join(', ')
            + (summary.labels.length > 8 ? `, … (+${summary.labels.length - 8} more)` : '');
          y = drawWrappedText(doc, `Categories: ${preview}`, PAGE_MARGIN + 12, y, contentWidth - 12, 12);
          doc.setTextColor(0);
        }
        y += 4;
      }
    }
  }

  if (priorityFindings && priorityFindings.length > 0) {
    sectionHeader('Priority Findings');
    for (const f of priorityFindings) {
      const prefix = f.severity === 'critical' ? '! ' : f.severity === 'warning' ? '* ' : '· ';
      const colorRGB = f.severity === 'critical' ? [185, 28, 28] : f.severity === 'warning' ? [161, 98, 7] : [55, 65, 81];
      doc.setTextColor(colorRGB[0], colorRGB[1], colorRGB[2]);
      y = drawWrappedText(doc, prefix + f.finding, PAGE_MARGIN, y, contentWidth, 13);
      doc.setTextColor(0);
      y += 2;
    }
  }

  if (methodologyNote) {
    sectionHeader('Methodology & Interpretation');
    doc.setTextColor(60);
    y = drawWrappedText(doc, methodologyNote, PAGE_MARGIN, y, contentWidth, 13);
    doc.setTextColor(0);
  }

  if (hasData) {
    sectionHeader(`Evidence Table (${data.length} record${data.length !== 1 ? 's' : ''})`);
    autoTable(doc, {
      head: [columns.map((column) => column.header)],
      body: data.map((row) => columns.map((column) => cellValue(row, column))),
      startY: y,
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [31, 41, 55], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: FOOTER_RESERVE + 8 },
    });
  } else if (hasNarrative) {
    sectionHeader('Evidence Table');
    doc.setTextColor(120);
    y = drawWrappedText(doc, 'No tabular evidence is available for this report in the current snapshot.', PAGE_MARGIN, y, contentWidth, 13);
    doc.setTextColor(0);
  }

  addFooterPageNumbers(doc);
  doc.save(datedFilename(filename, 'pdf'));
  return { success: true };
}

/**
 * Capture every `<canvas>` inside the container as PdfChartImage entries.
 * Title comes from the closest `[data-chart-title]` ancestor, falling back to "Chart N".
 */
export function captureChartImages(container: HTMLElement | null): PdfChartImage[] {
  if (!container) return [];
  const canvases = Array.from(container.querySelectorAll('canvas')) as HTMLCanvasElement[];
  const images: PdfChartImage[] = [];
  canvases.forEach((canvas, idx) => {
    if (!canvas.width || !canvas.height) return;
    const titleEl = canvas.closest('[data-chart-title]') as HTMLElement | null;
    const title = titleEl?.dataset.chartTitle?.trim() || `Chart ${idx + 1}`;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      images.push({ title, dataUrl, width: canvas.width, height: canvas.height });
    } catch {
      // tainted canvases are skipped
    }
  });
  return images;
}

/**
 * Trigger browser print dialog (user can save as PDF from here).
 */
export function printPage(): void {
  window.print();
}
