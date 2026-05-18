'use client';

import { ResponsiveLine } from '@nivo/line';
import type { LineCurveFactoryId } from '@nivo/core';
import { useNivoTheme } from '@/lib/ui/chart-theme';

// Minimal data shape expected by the wrapper. Caller can use string/number/Date
// for x; we don't constrain it because Nivo accepts heterogeneous x types.
export type BmedisLineSeries = {
  id: string | number;
  data: { x: string | number | Date; y: number | null }[];
};

// Opinionated wrapper around Nivo's ResponsiveLine for BMEDIS trend charts
// (compliance over time, scan trend, sync events, etc.). Defaults to a calm
// monotone curve, no point dots when there's a lot of data, and theme-driven
// grid/legend styling.

export type BmedisLineChartProps = {
  data: BmedisLineSeries[];
  /** Format y-axis values (e.g. percentage, count). */
  yFormat?: string | ((value: number | null) => string);
  /** Optional explicit colors. */
  colors?: string[];
  /** Show point dots; defaults to true when total points <= 24. */
  enablePoints?: boolean;
  /** Optional curve. Default 'monotoneX'. */
  curve?: LineCurveFactoryId;
  axisLeftLegend?: string;
  axisBottomLegend?: string;
  /** y-min/y-max (defaults to 'auto'). */
  yMin?: number | 'auto';
  yMax?: number | 'auto';
  /** Enable area fill below line. Default false. */
  enableArea?: boolean;
};

export default function BmedisLineChart({
  data,
  yFormat,
  colors,
  enablePoints,
  curve = 'monotoneX',
  axisLeftLegend,
  axisBottomLegend,
  yMin = 'auto',
  yMax = 'auto',
  enableArea = false,
}: BmedisLineChartProps) {
  const theme = useNivoTheme();
  const totalPoints = data.reduce((acc, serie) => acc + serie.data.length, 0);
  const showPoints = enablePoints ?? totalPoints <= 24;

  return (
    <ResponsiveLine
      data={data}
      theme={theme.nivo}
      colors={colors ?? theme.palette}
      margin={{ top: 16, right: 16, bottom: 44, left: 56 }}
      xScale={{ type: 'point' }}
      yScale={{ type: 'linear', min: yMin, max: yMax, stacked: false, reverse: false }}
      yFormat={yFormat}
      curve={curve}
      lineWidth={2}
      enableArea={enableArea}
      areaOpacity={0.18}
      enablePoints={showPoints}
      pointSize={6}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'serieColor' }}
      pointColor={{ theme: 'background' }}
      useMesh={true}
      axisLeft={{
        tickSize: 0,
        tickPadding: 6,
        legend: axisLeftLegend,
        legendOffset: -44,
        legendPosition: 'middle',
      }}
      axisBottom={{
        tickSize: 0,
        tickPadding: 6,
        tickRotation: 0,
        legend: axisBottomLegend,
        legendOffset: 36,
        legendPosition: 'middle',
      }}
      gridYValues={4}
      animate={true}
      motionConfig="gentle"
      role="img"
      ariaLabel={axisLeftLegend ?? axisBottomLegend ?? 'Line chart'}
    />
  );
}
