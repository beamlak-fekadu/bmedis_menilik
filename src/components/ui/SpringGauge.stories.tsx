import type { Meta, StoryObj } from '@storybook/nextjs';
import SpringGauge from './SpringGauge';

const meta: Meta<typeof SpringGauge> = {
  title: 'Foundation/SpringGauge',
  component: SpringGauge,
  parameters: {
    docs: {
      description: {
        component:
          'Compact circular gauge for compliance / readiness / availability metrics. `autoTone` resolves tone from value (≥85 success, ≥60 brand, ≥40 warning, else danger). NaN/null → muted "no data" arc.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof SpringGauge>;

export const Healthy: Story = {
  args: { value: 92, label: 'PM Compliance', autoTone: true },
};

export const Warning: Story = {
  args: { value: 55, label: 'Availability', autoTone: true },
};

export const Critical: Story = {
  args: { value: 28, label: 'Readiness', autoTone: true },
};

export const NoData: Story = {
  args: { value: null, label: 'Availability' },
};

export const Large: Story = {
  args: { value: 78, label: 'Health Score', size: 140, thickness: 12, autoTone: true },
};
