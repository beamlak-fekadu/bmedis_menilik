'use client';

import { useEffect, useState } from 'react';

type ChartTheme = {
  labelColor: string;
  gridColor: string;
  tooltipBackground: string;
  tooltipText: string;
  tooltipBorder: string;
};

function readChartTheme(): ChartTheme {
  if (typeof window === 'undefined') {
    return {
      labelColor: '#9ca3af',
      gridColor: 'rgba(75, 85, 99, 0.2)',
      tooltipBackground: 'rgba(17, 24, 39, 0.95)',
      tooltipText: '#f9fafb',
      tooltipBorder: 'rgba(75, 85, 99, 0.3)',
    };
  }
  const styles = window.getComputedStyle(document.documentElement);
  return {
    labelColor: styles.getPropertyValue('--chart-label').trim() || '#9ca3af',
    gridColor: styles.getPropertyValue('--chart-grid').trim() || 'rgba(75, 85, 99, 0.2)',
    tooltipBackground: styles.getPropertyValue('--chart-tooltip-bg').trim() || 'rgba(17, 24, 39, 0.95)',
    tooltipText: styles.getPropertyValue('--chart-tooltip-text').trim() || '#f9fafb',
    tooltipBorder: styles.getPropertyValue('--chart-tooltip-border').trim() || 'rgba(75, 85, 99, 0.3)',
  };
}

export function useChartTheme() {
  const [theme, setTheme] = useState<ChartTheme>(() => readChartTheme());

  useEffect(() => {
    const refresh = () => setTheme(readChartTheme());
    refresh();
    window.addEventListener('bmerms-theme-change', refresh as EventListener);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
    return () => {
      window.removeEventListener('bmerms-theme-change', refresh as EventListener);
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', refresh);
    };
  }, []);

  return theme;
}
