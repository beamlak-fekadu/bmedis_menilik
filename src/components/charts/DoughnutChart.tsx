'use client';

import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Title, Tooltip, Legend);

const DEFAULT_COLORS = [
  'rgb(37, 99, 235)',
  'rgb(34, 197, 94)',
  'rgb(234, 179, 8)',
  'rgb(239, 68, 68)',
  'rgb(168, 85, 247)',
];

interface DoughnutChartProps {
  labels: string[];
  data: number[];
  colors?: string[];
  title?: string;
  height?: number;
}

export default function DoughnutChart({
  labels,
  data,
  colors,
  title,
  height = 300,
}: DoughnutChartProps) {
  const backgroundColor = colors ?? DEFAULT_COLORS.slice(0, data.length);

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor,
        borderColor: 'transparent',
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      title: {
        display: !!title,
        text: title ?? '',
        color: '#9ca3af',
      },
      legend: {
        position: 'bottom' as const,
        labels: { color: '#9ca3af', padding: 16 },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f9fafb',
        bodyColor: '#f9fafb',
        borderColor: 'rgba(75, 85, 99, 0.3)',
        borderWidth: 1,
      },
    },
  };

  return (
    <div style={{ height }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
}
