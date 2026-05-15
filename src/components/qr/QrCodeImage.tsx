'use client';

// Shared QR code renderer for the BMERMS app.
// Wraps qrcode.react with consistent error-correction level (M is enough for
// printed labels and keeps the QR small) and a quiet zone margin.

import { forwardRef } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';

type Renderer = 'svg' | 'canvas';

type Props = {
  value: string;
  size?: number;
  renderer?: Renderer;
  className?: string;
};

const DEFAULT_SIZE = 192;
const ERROR_CORRECTION_LEVEL = 'M';
const QUIET_ZONE_INCLUDED = true;

export const QrCodeImage = forwardRef<HTMLCanvasElement | SVGSVGElement | null, Props>(
  function QrCodeImage({ value, size = DEFAULT_SIZE, renderer = 'svg', className }, ref) {
    const common = {
      value,
      size,
      level: ERROR_CORRECTION_LEVEL as 'L' | 'M' | 'Q' | 'H',
      bgColor: '#ffffff',
      fgColor: '#0a0a0a',
      marginSize: QUIET_ZONE_INCLUDED ? 2 : 0,
      className,
    };

    if (renderer === 'canvas') {
      return <QRCodeCanvas {...common} ref={ref as React.Ref<HTMLCanvasElement>} />;
    }
    return <QRCodeSVG {...common} ref={ref as React.Ref<SVGSVGElement>} />;
  },
);

export default QrCodeImage;
