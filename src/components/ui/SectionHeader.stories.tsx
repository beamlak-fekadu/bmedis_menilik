import type { Meta, StoryObj } from '@storybook/nextjs';
import SectionHeader from './SectionHeader';
import { Activity } from 'lucide-react';

const meta: Meta<typeof SectionHeader> = {
  title: 'Foundation/SectionHeader',
  component: SectionHeader,
  parameters: {
    docs: {
      description: {
        component:
          'Lightweight section header for grouping content inside a page. Pairs with `PageHeader` at the top — `SectionHeader` sits above each block of related cards/tables/charts.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof SectionHeader>;

export const Basic: Story = {
  args: {
    title: 'Critical Action Queue',
    description: 'Top-scored cross-category actions that need a decision today.',
  },
};

export const WithIcon: Story = {
  args: {
    title: 'Reliability',
    description: 'MTBF / MTTR / Availability over the last 90 days.',
    icon: <Activity className="h-4 w-4" />,
  },
};

export const WithEyebrow: Story = {
  args: {
    eyebrow: 'BME Command Center',
    title: 'Operational priorities',
    description: 'What needs your attention now, scored by cross-category urgency.',
  },
};

export const WithAction: Story = {
  args: {
    title: 'Recent activity',
    description: 'Latest maintenance events across the hospital.',
    action: (
      <button type="button" className="text-xs font-medium text-[var(--brand)] hover:underline">
        View all →
      </button>
    ),
  },
};
