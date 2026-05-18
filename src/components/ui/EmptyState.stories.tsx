import type { Meta, StoryObj } from '@storybook/nextjs';
import EmptyState from './EmptyState';
import { Bell, Inbox } from 'lucide-react';

const meta: Meta<typeof EmptyState> = {
  title: 'Foundation/EmptyState',
  component: EmptyState,
  parameters: {
    docs: {
      description: {
        component:
          'Empty state used inside cards/pages when there is no data. Supports an optional Lottie animation; falls back to a lucide icon when the asset is missing.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'No results',
    description: 'Try adjusting your filters or clearing the search.',
  },
};

export const WithCustomIcon: Story = {
  args: {
    title: 'No notifications yet',
    description: 'New notifications will show up here automatically.',
    icon: <Bell className="h-10 w-10" />,
  },
};

export const WithLottie: Story = {
  args: {
    title: 'You’re all caught up',
    description: 'Nothing in this view right now.',
    lottie: 'notification',
    icon: <Inbox className="h-10 w-10" />,
  },
};

export const Compact: Story = {
  args: {
    title: 'No data',
    description: 'Insufficient evidence to compute this metric.',
    compact: true,
  },
};
