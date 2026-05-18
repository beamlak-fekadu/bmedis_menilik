import type { Meta, StoryObj } from '@storybook/nextjs';
import BmedisLineChart from './BmedisLineChart';
import NivoChartShell from './NivoChartShell';

const meta: Meta<typeof BmedisLineChart> = {
  title: 'Charts/BmedisLineChart',
  component: BmedisLineChart,
  parameters: {
    docs: {
      description: {
        component:
          'Nivo `ResponsiveLine` with `monotoneX` default curve, theme-driven points (auto-hidden when total points > 24), optional area fill.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof BmedisLineChart>;

const monthly = [
  {
    id: 'Completed',
    data: [
      { x: 'Jan', y: 22 },
      { x: 'Feb', y: 25 },
      { x: 'Mar', y: 30 },
      { x: 'Apr', y: 28 },
      { x: 'May', y: 34 },
      { x: 'Jun', y: 38 },
    ],
  },
  {
    id: 'Overdue',
    data: [
      { x: 'Jan', y: 4 },
      { x: 'Feb', y: 6 },
      { x: 'Mar', y: 3 },
      { x: 'Apr', y: 5 },
      { x: 'May', y: 4 },
      { x: 'Jun', y: 2 },
    ],
  },
];

export const MaintenanceTrend: Story = {
  render: () => (
    <NivoChartShell title="Monthly maintenance throughput" height={320}>
      <BmedisLineChart data={monthly} axisLeftLegend="Work orders" />
    </NivoChartShell>
  ),
};

export const WithArea: Story = {
  render: () => (
    <NivoChartShell title="Scans over time" height={280}>
      <BmedisLineChart
        data={[
          {
            id: 'Scans',
            data: Array.from({ length: 14 }, (_, i) => ({ x: `D${i + 1}`, y: Math.round(Math.random() * 20) + 4 })),
          },
        ]}
        enableArea
        axisLeftLegend="QR scans"
      />
    </NivoChartShell>
  ),
};
