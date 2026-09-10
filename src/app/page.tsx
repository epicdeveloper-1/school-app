import { WeeklyStrategyBoard } from "@/components/weekly-strategy-board";

export default function Home() {
  return (
    <div className="app-shell relative min-h-full flex-1">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-24 right-[-8%] h-72 w-72 animate-soft-pulse rounded-full bg-seafoam/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 left-[-6%] h-56 w-56 animate-soft-pulse rounded-full bg-glow/25 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-6">
        <a href="#board" className="group inline-flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Weekly Strategy
          </span>
          <span className="hidden text-xs font-medium tracking-[0.18em] text-seafoam uppercase sm:inline">
            School
          </span>
        </a>
        <a
          href="#board"
          className="rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          Plan this week
        </a>
      </header>

      <main className="relative z-10">
        <section className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-20">
          <p className="animate-rise mb-4 text-sm font-medium tracking-[0.2em] text-seafoam uppercase">
            For students who plan ahead
          </p>
          <h1 className="animate-rise-delay-1 font-heading max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-6xl md:text-7xl">
            Weekly Strategy
          </h1>
          <p className="animate-rise-delay-2 mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Set one focus, map daily priorities, and lock subject targets —
            then walk into Monday with a clear school week.
          </p>
          <div className="animate-rise-delay-2 mt-8 flex flex-wrap gap-3">
            <a
              href="#board"
              className="rounded-lg bg-seafoam px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              Open your board
            </a>
            <a
              href="#how"
              className="rounded-lg border border-border bg-white/60 px-5 py-2.5 text-sm font-medium text-ink backdrop-blur-sm transition-colors hover:border-seafoam/50"
            >
              How it works
            </a>
          </div>
        </section>

        <section
          id="how"
          className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6"
        >
          <h2 className="font-heading text-2xl font-semibold text-ink">
            Three moves for the week
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Keep the plan short enough to finish. Progress saves automatically
            in your browser.
          </p>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            <li>
              <span className="text-xs font-semibold tracking-wider text-seafoam uppercase">
                01 Focus
              </span>
              <p className="mt-2 font-heading text-xl text-ink">
                Name the outcome
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                One sentence that defines a successful week.
              </p>
            </li>
            <li>
              <span className="text-xs font-semibold tracking-wider text-seafoam uppercase">
                02 Days
              </span>
              <p className="mt-2 font-heading text-xl text-ink">
                Place priorities
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add only what matters each day — check them off as you go.
              </p>
            </li>
            <li>
              <span className="text-xs font-semibold tracking-wider text-seafoam uppercase">
                03 Subjects
              </span>
              <p className="mt-2 font-heading text-xl text-ink">
                Aim by class
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Track targets per subject so nothing important slips.
              </p>
            </li>
          </ol>
        </section>

        <div id="board" className="scroll-mt-8">
          <WeeklyStrategyBoard />
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Weekly Strategy — a local school week planner. No account required.
      </footer>
    </div>
  );
}
