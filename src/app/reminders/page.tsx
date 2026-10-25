import { AppNav } from "@/components/app-nav";
import { SiteFooter } from "@/components/profile-copy";
import { RemindersPanel } from "@/components/reminders-panel";

export default function RemindersPage() {
  return (
    <div className="app-shell relative min-h-full flex-1">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 max-w-[50vw] animate-soft-pulse rounded-full bg-seafoam/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 left-0 h-56 w-56 max-w-[40vw] animate-soft-pulse rounded-full bg-glow/25 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-6">
        <a href="/" className="group inline-flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Weekly Strategy
          </span>
          <span className="hidden text-xs font-medium tracking-[0.18em] text-seafoam uppercase sm:inline">
            School
          </span>
        </a>
        <AppNav />
      </header>

      <main className="relative z-10">
        <RemindersPanel />
      </main>

      <SiteFooter />
    </div>
  );
}
