// Shared Nivo chart theme for BMEDIS. Hooks into the same CSS variables and
// `bmedis-theme-change` event used by Chart.js (`useChartTheme`), so a single
// theme switch retints both ecosystems.
//
// Status colors map to semantic CSS variables defined in globals.css.

'use client';

import { useEffect, useState } from 'react';
import type { PartialTheme } from '@nivo/theming';

export type BmedisChartTheme = {
  nivo: PartialTheme;
  palette: string[];
  semantic: {
    brand: string;
    brand2: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    muted: string;
  };
};

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readChartTheme(): BmedisChartTheme {
  const label = readCssVar('--chart-label', '#475569');
  const grid = readCssVar('--chart-grid', 'rgba(15,23,42,0.16)');
  const tooltipBg = readCssVar('--chart-tooltip-bg', 'rgba(15,23,42,0.92)');
  const tooltipText = readCssVar('--chart-tooltip-text', '#f8fafc');
  const tooltipBorder = readCssVar('--chart-tooltip-border', 'rgba(255,255,255,0.12)');

  const c1 = readCssVar('--chart-1', '#2563eb');
  const c2 = readCssVar('--chart-2', '#7c3aed');
  const c3 = readCssVar('--chart-3', '#0ea5e9');
  const c4 = readCssVar('--chart-4', '#10b981');
  const c5 = readCssVar('--chart-5', '#f59e0b');
  const c6 = readCssVar('--chart-6', '#ef4444');

  const brand = readCssVar('--brand', '#2563eb');
  const brand2 = readCssVar('--brand-2', '#7c3aed');
  const success = readCssVar('--success', '#059669');
  const warning = readCssVar('--warning', '#d97706');
  const danger = readCssVar('--danger', '#dc2626');
  const info = readCssVar('--chart-3', '#0ea5e9');
  const muted = readCssVar('--text-muted', '#334155');

  return {
    palette: [c1, c2, c3, c4, c5, c6],
    semantic: { brand, brand2, success, warning, danger, info, muted },
    nivo: {
      background: 'transparent',
      text: { fontSize: 12, fill: label, fontFamily: 'inherit' },
      axis: {
        domain: { line: { stroke: grid, strokeWidth: 1 } },
        legend: { text: { fontSize: 12, fill: label } },
        ticks: {
          line: { stroke: grid, strokeWidth: 1 },
          text: { fontSize: 11, fill: label },
        },
      },
      grid: { line: { stroke: grid, strokeWidth: 1, strokeDasharray: '3 3' } },
      legends: {
        title: { text: { fontSize: 11, fill: label } },
        text: { fontSize: 11, fill: label },
        ticks: { text: { fontSize: 10, fill: label } },
      },
      labels: { text: { fontSize: 11, fill: label, fontWeight: 600 } },
      tooltip: {
        container: {
          background: tooltipBg,
          color: tooltipText,
          fontSize: 12,
          borderRadius: 8,
          border: `1px solid ${tooltipBorder}`,
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.4)',
          padding: '8px 10px',
        },
      },
      annotations: {
        text: { fontSize: 11, fill: label, outlineWidth: 0 },
        link: { stroke: grid, strokeWidth: 1 },
        outline: { stroke: grid, strokeWidth: 1 },
        symbol: { fill: brand, outlineWidth: 0 },
      },
      crosshair: { line: { stroke: brand, strokeWidth: 1, strokeOpacity: 0.5 } },
    },
  };
}

export function useNivoTheme(): BmedisChartTheme {
  const [theme, setTheme] = useState<BmedisChartTheme>(() => readChartTheme());

  useEffect(() => {
    const refresh = () => setTheme(readChartTheme());
    refresh();
    window.addEventListener('bmedis-theme-change', refresh as EventListener);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', refresh);
    return () => {
      window.removeEventListener('bmedis-theme-change', refresh as EventListener);
      media.removeEventListener('change', refresh);
    };
  }, []);

  return theme;
}

// Stable colors for common semantic categories. Use when a series has a known
// status meaning rather than letting Nivo auto-assign from the palette.
export const STATUS_COLOR_MAP: Record<string, keyof BmedisChartTheme['semantic']> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'success',
  ok: 'success',
  healthy: 'success',
  warning: 'warning',
  blocked: 'danger',
  overdue: 'danger',
  upcoming: 'info',
  completed: 'success',
  pending: 'warning',
};
