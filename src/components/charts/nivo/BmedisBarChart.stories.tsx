import type { Meta, StoryObj } from '@storybook/nextjs';
import BmedisBarChart from './BmedisBarChart';
import NivoChartShell from './NivoChartShell';

const meta: Meta<typeof BmedisBarChart> = {
  title: 'Charts/BmedisBarChart',
  component: BmedisBarChart,
  parameters: {
    docs: {
      description: {
        component:
          'Nivo `ResponsiveBar` with the BMEDIS theme: 0.28 padding, rounded corners, theme-driven palette. Use inside `NivoChartShell` for empty-state handling.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof BmedisBarChart>;

const departmentCompliance = [
  { department: 'ICU', compliance: 88 },
  { department: 'OR', compliance: 73 },
  { department: 'Lab', compliance: 82 },
  { department: 'Radiology', compliance: 91 },
  { department: 'Pharmacy', compliance: 67 },
  { department: 'Inpatient', compliance: 78 },
];

export const Vertical: Story = {
  render: () => (
    <NivoChartShell
      title="PM Compliance by Department"
      description="Last 12 months."
      height={320}
    >
      <BmedisBarChart
        data={departmentCompliance}
        keys={['compliance']}
        indexBy="department"
        axisLeftLegend="Compliance %"
      />
    </NivoChartShell>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <NivoChartShell title="Technician workload" height={300}>
      <BmedisBarChart
        data={[
          { tech: 'A. Bekele', open: 6 },
          { tech: 'M. Tadesse', open: 4 },
          { tech: 'S. Demeke', open: 3 },
          { tech: 'H. Yohannes', open: 8 },
        ]}
        keys={['open']}
        indexBy="tech"
        layout="horizontal"
        axisBottomLegend="Open work orders"
      />
    </NivoChartShell>
  ),
};
