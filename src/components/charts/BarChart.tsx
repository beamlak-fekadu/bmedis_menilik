'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useChartTheme } from './useChartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DEFAULT_COLORS = [
  'rgb(37, 99, 235)',   // blue-600
  'rgb(34, 197, 94)',   // green-500
  'rgb(234, 179, 8)',   // yellow-500
  'rgb(239, 68, 68)',   // red-500
  'rgb(168, 85, 247)',  // purple-500
];

interface BarChartProps {
  labels: string[];
  datasets: { label: string; data: number[]; backgroundColor?: string | string[] }[];
  horizontal?: boolean;
  title?: string;
  height?: number;
}

export default function BarChart({
  labels,
  datasets,
  horizontal = false,
  title,
  height = 300,
}: BarChartProps) {
  const chartTheme = useChartTheme();
  const coloredDatasets = datasets.map((ds, i) => ({
    ...ds,
    backgroundColor: ds.backgroundColor ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: (horizontal ? 'y' : 'x') as 'x' | 'y',
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
      <Bar data={{ labels, datasets: coloredDatasets }} options={options} />
    </div>
  );
}
