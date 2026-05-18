'use client';

import { ResponsivePie } from '@nivo/pie';
import { useNivoTheme } from '@/lib/ui/chart-theme';

// Opinionated wrapper around Nivo's ResponsivePie for BMEDIS donut/pie charts
// (risk distribution, condition breakdown, etc.). Defaults to a donut with a
// soft inner radius, readable arc labels, and a slim legend.

export type BmedisPieDatum = {
  id: string;
  label?: string;
  value: number;
  color?: string;
};

export type BmedisPieChartProps = {
  data: BmedisPieDatum[];
  /** Donut hole size 0–1. Default 0.6 (proper donut). 0 = pie. */
  innerRadius?: number;
  /** Format the centre/tooltip value, e.g. percentage. */
  valueFormat?: string | ((value: number) => string);
  /** Show inline arc labels. Default true. */
  enableArcLabels?: boolean;
  /** Show arc link labels (lines pointing out). Default false (cleaner). */
  enableArcLinkLabels?: boolean;
  /** Show legend below chart. Default true. */
  enableLegend?: boolean;
};

export default function BmedisPieChart({
  data,
  innerRadius = 0.6,
  valueFormat,
  enableArcLabels = true,
  enableArcLinkLabels = false,
  enableLegend = true,
}: BmedisPieChartProps) {
  const theme = useNivoTheme();

  return (
    <ResponsivePie
      data={data}
      theme={theme.nivo}
      colors={data.map((d, i) => d.color ?? theme.palette[i % theme.palette.length])}
      margin={{ top: 8, right: 16, bottom: enableLegend ? 48 : 8, left: 16 }}
      innerRadius={innerRadius}
      padAngle={0.6}
      cornerRadius={3}
      activeOuterRadiusOffset={6}
      borderWidth={1}
      borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
      enableArcLabels={enableArcLabels}
      arcLabelsSkipAngle={12}
      arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
      enableArcLinkLabels={enableArcLinkLabels}
      arcLinkLabelsSkipAngle={12}
      arcLinkLabelsThickness={1}
      arcLinkLabelsTextColor={theme.semantic.muted}
      valueFormat={valueFormat}
      animate
      motionConfig="gentle"
      legends={
        enableLegend
          ? [
              {
                anchor: 'bottom',
                direction: 'row',
                translateY: 36,
                itemsSpacing: 6,
                itemWidth: 90,
                itemHeight: 14,
                itemTextColor: theme.semantic.muted,
                symbolShape: 'circle',
              },
            ]
          : []
      }
      role="img"
    />
  );
}
