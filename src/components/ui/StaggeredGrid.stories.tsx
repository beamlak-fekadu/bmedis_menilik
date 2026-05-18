import type { Meta, StoryObj } from '@storybook/nextjs';
import { StaggeredGrid, StaggeredItem } from './StaggeredGrid';
import Card from './Card';

const meta: Meta<typeof StaggeredGrid> = {
  title: 'Foundation/StaggeredGrid',
  component: StaggeredGrid,
  parameters: {
    docs: {
      description: {
        component:
          'Tiny client-side wrapper that lets server-rendered pages opt into `cardStagger` reveal without converting the entire page to a client component. Use `StaggeredGrid` as the parent and `StaggeredItem` for each cell.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof StaggeredGrid>;

export const FourTiles: Story = {
  render: () => (
    <StaggeredGrid className="grid gap-3 md:grid-cols-4">
      {['Ranked assets', 'Health checks', 'Last refresh', 'Status'].map((label, i) => (
        <StaggeredItem key={label}>
          <Card>
            <p className="text-sm text-[var(--text-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{['80', '14', '2m ago', 'OK'][i]}</p>
          </Card>
        </StaggeredItem>
      ))}
    </StaggeredGrid>
  ),
};
