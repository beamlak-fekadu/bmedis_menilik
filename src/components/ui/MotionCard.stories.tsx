import type { Meta, StoryObj } from '@storybook/nextjs';
import MotionCard from './MotionCard';
import { motion } from 'framer-motion';
import { cardStagger } from '@/lib/ui/motion-presets';

const meta: Meta<typeof MotionCard> = {
  title: 'Foundation/MotionCard',
  component: MotionCard,
  parameters: {
    docs: {
      description: {
        component:
          'Motion-aware wrapper around the BMEDIS panel surface. Drops into stagger lists (use with `cardStagger` on the parent) without breaking the existing glass `panel-surface` look. Carries `cardItem` + `subtleHover` lift.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof MotionCard>;

export const Single: Story = {
  render: () => (
    <MotionCard>
      <p className="text-sm text-[var(--text-muted)]">Headline KPI</p>
      <p className="mt-1 text-2xl font-semibold">128</p>
    </MotionCard>
  ),
};

export const StaggerGrid: Story = {
  render: () => (
    <motion.div variants={cardStagger} initial="initial" animate="animate" className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <MotionCard key={i}>
          <p className="text-sm text-[var(--text-muted)]">Metric {i + 1}</p>
          <p className="mt-1 text-2xl font-semibold">{Math.round(Math.random() * 100)}</p>
        </MotionCard>
      ))}
    </motion.div>
  ),
};
