import { CONDITION_COLORS } from '@/constants';

/**
 * Decorative-only replica of the dashboard / analytics shell for auth pages.
 * Heavily blurred by the parent; no data fetches, no pointer events.
 * Color hints align with StatCard + condition charts on the real dashboard.
 */
const STAT_WELLS: { well: string; icon: string }[] = [
  { well: 'bg-blue-500/14', icon: 'bg-blue-500/22' },
  { well: 'bg-emerald-500/14', icon: 'bg-emerald-500/22' },
  { well: 'bg-rose-500/12', icon: 'bg-rose-500/20' },
  { well: 'bg-amber-500/12', icon: 'bg-amber-500/20' },
  { well: 'bg-orange-500/12', icon: 'bg-orange-500/20' },
  { well: 'bg-violet-500/12', icon: 'bg-violet-500/20' },
  { well: 'bg-orange-500/10', icon: 'bg-orange-500/18' },
  { well: 'bg-rose-500/10', icon: 'bg-rose-500/18' },
];

const BAR_FILL_SEQUENCE = [
  CONDITION_COLORS.functional,
  CONDITION_COLORS.needs_repair,
  CONDITION_COLORS.non_functional,
  CONDITION_COLORS.under_maintenance,
  CONDITION_COLORS.decommissioned,
  '#6366F1',
  '#0EA5E9',
  '#8B5CF6',
  '#F59E0B',
];

export default function AuthDashboardBackdrop() {
  const barHeights = [32, 52, 38, 64, 44, 58, 40, 68, 48];

  return (
    <div className="flex min-h-screen w-full min-w-[960px] translate-x-1 text-[var(--foreground)] lg:translate-x-3" aria-hidden>
      <aside className="panel-surface flex w-[17rem] shrink-0 flex-col border-r border-[var(--border-subtle)] lg:w-72">
        <div className="flex h-16 items-center gap-3 border-b border-[var(--border-subtle)] px-4">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-[var(--surface-3)]" />
          <div className="h-4 w-24 rounded-md bg-[var(--surface-3)]" />
        </div>
        <div className="flex flex-1 flex-col gap-5 px-3 py-4">
          {[1, 2, 3].map((g) => (
            <div key={g} className="space-y-2">
              <div className="h-2 w-16 rounded bg-[var(--surface-3)] opacity-80" />
              {[1, 2, 3, 4].map((i) => (
                <div key={`${g}-${i}`} className="flex h-9 items-center gap-2 rounded-lg bg-[var(--surface-2)] px-2">
                  <div className="h-4 w-4 shrink-0 rounded bg-[var(--surface-3)]" />
                  <div className="h-2.5 flex-1 rounded bg-[var(--surface-3)] opacity-70" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--background)]">
        <header className="panel-surface-muted flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 lg:px-6">
          <div className="space-y-1.5">
            <div className="h-3 w-28 rounded bg-[var(--surface-3)]" />
            <div className="h-2 w-40 rounded bg-[var(--surface-2)]" />
          </div>
          <div className="hidden max-w-md flex-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 md:flex">
            <div className="h-3 w-3 shrink-0 rounded-sm bg-[var(--surface-3)]" />
            <div className="h-2 flex-1 rounded bg-[var(--surface-3)] opacity-60" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--surface-2)]" />
            <div className="h-8 w-8 rounded-lg bg-[var(--surface-2)]" />
            <div className="h-8 w-8 rounded-full bg-[var(--surface-3)]" />
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 pl-3 lg:gap-5 lg:p-6 lg:pl-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:translate-x-1">
            {STAT_WELLS.map((sw, i) => (
              <div
                key={i}
                className="panel-surface relative flex h-[5.5rem] flex-col justify-between overflow-hidden rounded-2xl p-3"
              >
                <div className={`pointer-events-none absolute -right-1 -top-1 h-16 w-16 rounded-full ${sw.well} blur-md`} />
                <div className="relative h-2 w-20 rounded bg-[var(--surface-3)] opacity-70" />
                <div className="relative flex items-end justify-between gap-2">
                  <div className="h-7 w-12 rounded-md bg-[var(--surface-3)]" />
                  <div className={`h-7 w-7 shrink-0 rounded-lg ${sw.icon}`} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-5 lg:gap-4">
            <div className="panel-surface relative flex min-h-[11rem] flex-col overflow-hidden rounded-2xl p-4 lg:col-span-3">
              <div className="mb-3 h-2 w-32 rounded bg-[var(--surface-3)]" />
              <div className="relative flex flex-1 flex-col justify-end pt-4">
                <div className="flex flex-1 items-end gap-1.5 px-1">
                  {barHeights.map((px, j) => (
                    <div
                      key={j}
                      className="flex-1 rounded-t-sm opacity-[0.72]"
                      style={{
                        height: `${px}px`,
                        backgroundColor: BAR_FILL_SEQUENCE[j % BAR_FILL_SEQUENCE.length],
                      }}
                    />
                  ))}
                </div>
                <svg
                  className="pointer-events-none absolute bottom-8 left-2 right-2 h-12 w-[calc(100%-1rem)] text-sky-400/25 dark:text-sky-300/20"
                  viewBox="0 0 400 48"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="0,38 44,28 88,34 132,18 176,24 220,12 264,20 308,8 352,16 400,10"
                  />
                </svg>
              </div>
            </div>
            <div className="panel-surface relative flex min-h-[11rem] flex-col items-center justify-center overflow-hidden rounded-2xl p-4 lg:col-span-2">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <div className="pointer-events-none absolute inset-[-6px] rounded-full border border-cyan-400/18 dark:border-cyan-300/14" />
                <div className="h-28 w-28 rounded-full border-8 border-[var(--surface-3)] border-t-[var(--brand)] opacity-90" />
              </div>
              <div className="mt-3 h-2 w-24 rounded bg-[var(--surface-3)]" />
            </div>
          </div>

          <div className="panel-surface rounded-2xl p-4 lg:mr-6">
            <div className="mb-3 h-2 w-36 rounded bg-[var(--surface-3)]" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, r) => (
                <div key={r} className="flex gap-3 border-b border-[var(--border-subtle)] py-2 last:border-0">
                  <div className="h-2 w-16 shrink-0 rounded bg-[var(--surface-2)]" />
                  <div className="h-2 flex-1 rounded bg-[var(--surface-2)]" />
                  <div
                    className="h-2 w-20 shrink-0 rounded opacity-50"
                    style={{
                      backgroundColor: BAR_FILL_SEQUENCE[r % BAR_FILL_SEQUENCE.length],
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
