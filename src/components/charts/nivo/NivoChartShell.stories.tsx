import type { Meta, StoryObj } from '@storybook/nextjs';
import NivoChartShell from './NivoChartShell';

const meta: Meta<typeof NivoChartShell> = {
  title: 'Charts/NivoChartShell',
  component: NivoChartShell,
  parameters: {
    docs: {
      description: {
        component:
          'Shared shell for Nivo charts. Provides title/footer/empty-state chrome with explicit height. Renders `EmptyState` (compact) when `isEmpty` instead of a blank chart.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof NivoChartShell>;

export const Empty: Story = {
  args: {
    title: 'PM Compliance by Department',
    description: 'Completed scheduled PM tasks ÷ total scheduled PM tasks × 100.',
    isEmpty: true,
    emptyDescription: 'No PM schedule history is recorded yet.',
    children: null,
  },
};

export const WithChildren: Story = {
  args: {
    title: 'Risk Distribution',
    description: 'RPN bands across active equipment.',
    height: 280,
    children: (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-[var(--border-subtle)] text-sm text-[var(--text-muted)]">
        Chart goes here
      </div>
    ),
  },
};
