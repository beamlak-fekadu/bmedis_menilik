// QR label rendering helpers (Phase 2).
//
// Client-side composition: draws a labelled sticker onto a canvas using an
// existing QR canvas as the image source, then returns a PNG data URL.
// No external image services — generation is fully local.

export type QrLabelInfo = {
  assetCode: string;
  assetName: string;
  departmentName?: string | null;
  scanInstruction?: string;
};

export type QrLabelCanvasOptions = {
  qrSource: HTMLCanvasElement | null;
  info: QrLabelInfo;
  /** Logical width/height in CSS px. The actual canvas is upscaled for DPI. */
  width?: number;
  height?: number;
  scale?: number;
};

const DEFAULT_LABEL_WIDTH = 360;
const DEFAULT_LABEL_HEIGHT = 480;
const DEFAULT_SCALE = 2;

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  baseFontSize: number,
  minFontSize: number,
  fontWeight: number | string,
  family = 'Inter, system-ui, sans-serif',
): { size: number; text: string } {
  let size = baseFontSize;
  ctx.font = `${fontWeight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > minFontSize) {
    size -= 1;
    ctx.font = `${fontWeight} ${size}px ${family}`;
  }
  if (ctx.measureText(text).width > maxWidth) {
    let truncated = text;
    while (truncated.length > 4 && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return { size, text: `${truncated}…` };
  }
  return { size, text };
}

/**
 * Composes a full QR sticker onto an offscreen canvas and returns a PNG data URL.
 * Throws if no QR source canvas is provided.
 */
export function renderQrLabelToDataUrl(options: QrLabelCanvasOptions): string {
  const {
    qrSource,
    info,
    width = DEFAULT_LABEL_WIDTH,
    height = DEFAULT_LABEL_HEIGHT,
    scale = DEFAULT_SCALE,
  } = options;

  if (!qrSource) throw new Error('QR source canvas is not ready');

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context not available');

  ctx.scale(scale, scale);

  // Background + border.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // BMERMS header bar.
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, 28);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 14px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('BMERMS', 12, 14);
  ctx.textAlign = 'right';
  ctx.font = '500 11px Inter, system-ui, sans-serif';
  ctx.fillText('Equipment QR', width - 12, 14);
  ctx.textAlign = 'left';

  // Asset code (large).
  ctx.fillStyle = '#111111';
  const codeFit = fitText(ctx, info.assetCode, width - 24, 24, 14, 700);
  ctx.font = `700 ${codeFit.size}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(codeFit.text, 12, 56);

  // Asset name.
  const nameFit = fitText(ctx, info.assetName, width - 24, 16, 11, 500);
  ctx.fillStyle = '#222222';
  ctx.font = `500 ${nameFit.size}px Inter, system-ui, sans-serif`;
  ctx.fillText(nameFit.text, 12, 78);

  // Department line.
  if (info.departmentName) {
    const deptFit = fitText(ctx, info.departmentName, width - 24, 12, 10, 400);
    ctx.fillStyle = '#444444';
    ctx.font = `400 ${deptFit.size}px Inter, system-ui, sans-serif`;
    ctx.fillText(deptFit.text, 12, 96);
  }

  // QR image — preserve sharp pixels.
  const qrTarget = Math.min(width - 48, height - 180);
  const qrX = (width - qrTarget) / 2;
  const qrY = 110;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrSource, qrX, qrY, qrTarget, qrTarget);

  // Scan instruction.
  const instruction = info.scanInstruction ?? 'Scan for service record';
  ctx.fillStyle = '#111111';
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(instruction, width / 2, qrY + qrTarget + 22);

  // Footer note.
  ctx.fillStyle = '#555555';
  ctx.font = '400 10px Inter, system-ui, sans-serif';
  ctx.fillText('QR does not grant access. Login required.', width / 2, qrY + qrTarget + 38);

  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

export function sanitizeFileName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .toLowerCase();
}

export function createQrLabelFileName(assetCode: string, assetName?: string | null): string {
  const base = assetCode ? sanitizeFileName(assetCode) : 'asset';
  const suffix = assetName ? `-${sanitizeFileName(assetName).slice(0, 24)}` : '';
  return `bmerms-qr-${base}${suffix}.png`.replace(/-+\./, '.');
}

export function triggerDataUrlDownload(dataUrl: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
