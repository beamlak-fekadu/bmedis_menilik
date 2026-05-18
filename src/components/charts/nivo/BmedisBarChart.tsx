'use client';

import { ResponsiveBar, type BarDatum } from '@nivo/bar';
import { useNivoTheme } from '@/lib/ui/chart-theme';

// Thin opinionated wrapper around Nivo's ResponsiveBar that:
//  - applies the BMEDIS Nivo theme,
//  - uses the shared palette,
//  - has sensible defaults for hospital-ops dashboards (compact margins,
//    no axis title clutter, readable tick rotation),
//  - never renders fake data — caller is responsible for `data`.
//
// For empty / no-data states, wrap in `NivoChartShell` and pass `isEmpty`.

export type BmedisBarChartProps = {
  data: BarDatum[];
  /** Series keys to plot (one bar per key per indexed row). */
  keys: string[];
  /** The category dimension key in `data` rows. */
  indexBy: string;
  /** Grouped vs stacked. Default 'grouped'. */
  groupMode?: 'grouped' | 'stacked';
  /** Horizontal vs vertical. Default 'vertical'. */
  layout?: 'horizontal' | 'vertical';
  /** Optional explicit colors. Falls back to theme palette. */
  colors?: string[];
  /** Tick rotation in degrees (bottom axis). Default 0 (auto -22 if many cats). */
  tickRotation?: number;
  /** Show values inside each bar. Default false (cleaner look). */
  enableLabel?: boolean;
  /** Format axis values (e.g. percentage). */
  valueFormat?: string | ((value: number) => string);
  /** Optional left-axis legend (e.g. "Open requests"). */
  axisLeftLegend?: string;
  /** Optional bottom-axis legend. */
  axisBottomLegend?: string;
};

export default function BmedisBarChart({
  data,
  keys,
  indexBy,
  groupMode = 'grouped',
  layout = 'vertical',
  colors,
  tickRotation,
  enableLabel = false,
  valueFormat,
  axisLeftLegend,
  axisBottomLegend,
}: BmedisBarChartProps) {
  const theme = useNivoTheme();
  const autoRotation =
    tickRotation ??
    (layout === 'vertical' && data.length > 6 ? -22 : 0);

  return (
    <ResponsiveBar
      data={data}
      keys={keys}
      indexBy={indexBy}
      groupMode={groupMode}
      layout={layout}
      margin={{ top: 12, right: 16, bottom: 44, left: 56 }}
      padding={0.28}
      innerPadding={2}
      borderRadius={4}
      colors={colors ?? theme.palette}
      theme={theme.nivo}
      enableLabel={enableLabel}
      labelSkipWidth={18}
      labelSkipHeight={14}
      labelTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
      valueFormat={valueFormat}
      axisLeft={{
        tickPadding: 6,
        tickSize: 0,
        legend: axisLeftLegend,
        legendOffset: -44,
        legendPosition: 'middle',
      }}
      axisBottom={{
        tickPadding: 6,
        tickSize: 0,
        tickRotation: autoRotation,
        legend: axisBottomLegend,
        legendOffset: 36,
        legendPosition: 'middle',
      }}
      gridYValues={4}
      animate={true}
      motionConfig="gentle"
      role="img"
      ariaLabel={axisLeftLegend ?? axisBottomLegend ?? 'Bar chart'}
    />
  );
}
