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
  'rgb(37, 99, 235)',
  'rgb(34, 197, 94)',
  'rgb(234, 179, 8)',
  'rgb(239, 68, 68)',
  'rgb(168, 85, 247)',
];

interface HorizontalBarChartProps {
  labels: string[];
  values: number[];
  colors?: string[];
  title?: string;
  height?: number;
}

export default function HorizontalBarChart({
  labels,
  values,
  colors,
  title,
  height = 300,
}: HorizontalBarChartProps) {
  const chartTheme = useChartTheme();
  const backgroundColor = colors ?? labels.map((_, i) => DEFAULT_COLORS[i % DEFAULT_COLORS.length]);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      title: {
        display: !!title,
        text: title ?? '',
        color: chartTheme.labelColor,
      },
      legend: { display: false },
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
        grid: { display: false },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
}
