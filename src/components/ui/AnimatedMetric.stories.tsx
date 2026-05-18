import type { Meta, StoryObj } from '@storybook/nextjs';
import AnimatedMetric from './AnimatedMetric';

const meta: Meta<typeof AnimatedMetric> = {
  title: 'Foundation/AnimatedMetric',
  component: AnimatedMetric,
  parameters: {
    docs: {
      description: {
        component:
          'React-spring number counter. Honours `prefers-reduced-motion`. Use only for headline KPIs — do not animate every cell in a table.',
      },
    },
  },
  args: { value: 80 },
};
export default meta;

type Story = StoryObj<typeof AnimatedMetric>;

export const Default: Story = {};

export const WithDecimals: Story = {
  args: { value: 91.4, decimals: 1, suffix: '%' },
};

export const Currency: Story = {
  args: { value: 12450, prefix: '$' },
};

export const Large: Story = {
  args: { value: 1245, className: 'text-4xl font-bold tabular-nums' },
};
