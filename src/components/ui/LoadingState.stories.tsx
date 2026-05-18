import type { Meta, StoryObj } from '@storybook/nextjs';
import LoadingState from './LoadingState';

const meta: Meta<typeof LoadingState> = {
  title: 'Foundation/LoadingState',
  component: LoadingState,
  parameters: {
    docs: {
      description: {
        component:
          'Page/card-level loading state. Falls back to a spinner when the optional `.lottie` asset is unavailable. Use this for "filling a card or page region" loading states; `Spinner` covers button/inline cases.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof LoadingState>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    title: 'Generating report',
    description: 'Compiling 80 assets and 6 quarters of compliance data…',
  },
};

export const SmallInsideCard: Story = {
  args: { size: 'sm', compact: true, title: 'Refreshing' },
  render: (args) => (
    <div className="panel-surface rounded-2xl p-4">
      <LoadingState {...args} />
    </div>
  ),
};

export const AiThinking: Story = {
  args: { lottie: 'aiThinking', title: 'Copilot is thinking' },
};
