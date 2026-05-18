import type { Meta, StoryObj } from '@storybook/nextjs';
import LottiePlayer, { LOTTIE_PATHS } from './LottiePlayer';
import { Inbox } from 'lucide-react';

const meta: Meta<typeof LottiePlayer> = {
  title: 'Foundation/LottiePlayer',
  component: LottiePlayer,
  parameters: {
    docs: {
      description: {
        component:
          'Dynamic-import wrapper around `@lottiefiles/dotlottie-react`. HEAD-checks the asset URL and renders the supplied fallback when missing or under `prefers-reduced-motion`. No external CDN fetches.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof LottiePlayer>;

export const Empty: Story = {
  args: {
    src: LOTTIE_PATHS.empty,
    style: { width: 140, height: 140 },
    fallback: <Inbox className="h-12 w-12 text-[var(--text-subtle)]" />,
  },
};

export const AiThinking: Story = {
  args: {
    src: LOTTIE_PATHS.aiThinking,
    style: { width: 96, height: 96 },
    fallback: <Inbox className="h-8 w-8 text-[var(--text-subtle)]" />,
  },
};

export const MissingAsset: Story = {
  args: {
    src: '/lottie/does-not-exist.lottie',
    style: { width: 140, height: 140 },
    fallback: (
      <div className="rounded-md border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
        Asset not found — fallback rendered
      </div>
    ),
  },
};
