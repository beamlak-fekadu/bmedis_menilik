import AuthDashboardBackdrop from '@/components/auth/AuthDashboardBackdrop';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 flex items-start justify-center pt-0">
          <div className="h-full w-[min(128vw,1400px)] max-w-none shrink-0 origin-top scale-[1.05] blur-[44px] sm:scale-[1.08] sm:blur-[52px] lg:blur-[60px]">
            <AuthDashboardBackdrop />
          </div>
        </div>

        <div className="absolute -left-[8%] top-[5%] h-[min(20rem,36vh)] w-[min(22rem,48vw)] rounded-full bg-[rgb(59_130_246/0.1)] blur-[80px] dark:bg-[rgb(96_165_250/0.11)]" />
        <div className="absolute -right-[6%] top-[12%] h-[min(18rem,32vh)] w-[min(20rem,42vw)] rounded-full bg-[rgb(245_158_11/0.08)] blur-[76px] dark:bg-[rgb(251_191_36/0.09)]" />
        <div className="absolute bottom-[8%] left-[-4%] h-[min(16rem,28vh)] w-[min(18rem,40vw)] rounded-full bg-[rgb(16_185_129/0.08)] blur-[72px] dark:bg-[rgb(52_211_153/0.09)]" />
        <div className="absolute bottom-[4%] right-[-6%] h-[min(17rem,30vh)] w-[min(19rem,44vw)] rounded-full bg-[rgb(244_63_94/0.07)] blur-[74px] dark:bg-[rgb(251_113_133/0.08)]" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_68%_54%_at_50%_38%,transparent_0%,var(--background)_62%)]" />
        <div className="absolute inset-0 bg-[var(--background)]/60 dark:bg-[var(--background)]/52" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="auth-form-shell w-full max-w-md rounded-3xl border border-[var(--border-subtle)]/80 bg-[var(--surface-1)]/38 px-7 py-9 shadow-[0_20px_40px_-16px_rgb(0_0_0/0.28)] backdrop-blur-md sm:px-10 sm:py-11 dark:bg-[var(--surface-1)]/32 dark:shadow-[0_24px_48px_-18px_rgb(0_0_0/0.38)]">
          {children}
        </div>
      </div>
    </div>
  );
}
