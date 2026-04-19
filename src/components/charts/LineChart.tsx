'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useChartTheme } from './useChartTheme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const DEFAULT_BORDER_COLORS = [
  'rgb(37, 99, 235)',
  'rgb(34, 197, 94)',
  'rgb(234, 179, 8)',
  'rgb(239, 68, 68)',
  'rgb(168, 85, 247)',
];

interface LineDataset {
  label: string;
  data: number[];
  borderColor?: string;
  tension?: number;
}

interface LineChartProps {
  labels: string[];
  datasets: LineDataset[];
  title?: string;
  height?: number;
}

export default function LineChart({
  labels,
  datasets,
  title,
  height = 300,
}: LineChartProps) {
  const chartTheme = useChartTheme();
  const coloredDatasets = datasets.map((ds, i) => ({
    ...ds,
    borderColor: ds.borderColor ?? DEFAULT_BORDER_COLORS[i % DEFAULT_BORDER_COLORS.length],
    backgroundColor: 'transparent',
    tension: ds.tension ?? 0.3,
    pointRadius: 3,
    pointHoverRadius: 6,
  }));

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: !!title,
        text: title ?? '',
        color: chartTheme.labelColor,
      },
      legend: {
        labels: { color: chartTheme.labelColor },
      },
      tooltip: {
        backgroundColor: chartTheme.tooltipBackground,
        titleColor: chartTheme.tooltipText,
        bodyColor: chartTheme.tooltipText,
        borderColor: chartTheme.tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: chartTheme.labelColor },
        grid: { color: chartTheme.gridColor },
      },
      y: {
        ticks: { color: chartTheme.labelColor },
        grid: { color: chartTheme.gridColor },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Line data={{ labels, datasets: coloredDatasets }} options={options} />
    </div>
  );
}
