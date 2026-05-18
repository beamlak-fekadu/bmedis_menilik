import type { Meta, StoryObj } from '@storybook/nextjs';
import BmedisPieChart from './BmedisPieChart';
import NivoChartShell from './NivoChartShell';

const meta: Meta<typeof BmedisPieChart> = {
  title: 'Charts/BmedisPieChart',
  component: BmedisPieChart,
  parameters: {
    docs: {
      description: {
        component:
          'Nivo `ResponsivePie` donut. Default `innerRadius=0.6` with padded arcs and slim legend.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof BmedisPieChart>;

export const RiskDistribution: Story = {
  render: () => (
    <NivoChartShell title="Risk distribution" height={320}>
      <BmedisPieChart
        data={[
          { id: 'low', label: 'Low', value: 38 },
          { id: 'medium', label: 'Medium', value: 21 },
          { id: 'high', label: 'High', value: 14 },
          { id: 'critical', label: 'Critical', value: 7 },
        ]}
      />
    </NivoChartShell>
  ),
};

export const ConditionBreakdown: Story = {
  render: () => (
    <NivoChartShell title="Condition breakdown" height={300}>
      <BmedisPieChart
        innerRadius={0.4}
        data={[
          { id: 'functional', label: 'Functional', value: 62 },
          { id: 'needs_repair', label: 'Needs repair', value: 11 },
          { id: 'non_functional', label: 'Non-functional', value: 5 },
          { id: 'under_maintenance', label: 'Under maintenance', value: 2 },
        ]}
      />
    </NivoChartShell>
  ),
};
