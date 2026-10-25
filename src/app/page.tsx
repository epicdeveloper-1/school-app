import { AppNav } from "@/components/app-nav";
import { HeroDetail, HeroEyebrow, SiteFooter } from "@/components/profile-copy";
import { WeeklyStrategyBoard } from "@/components/weekly-strategy-board";
import type { ComponentType } from "react";

const Cs234Checklist: ComponentType =
  process.env.NEXT_PUBLIC_APP_PROFILE === "blank"
    ? function HiddenCs234Checklist() {
        return null;
      }
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/components/cs234-checklist").Cs234Checklist;

export default function Home() {
  return (
    <div className="app-shell relative min-h-full flex-1">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 max-w-[50vw] animate-soft-pulse rounded-full bg-seafoam/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 left-0 h-56 w-56 max-w-[40vw] animate-soft-pulse rounded-full bg-glow/25 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-6">
        <a href="#board" className="group inline-flex items-baseline gap-2">
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
        <section className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-20">
          <p className="animate-rise mb-4 text-sm font-medium tracking-[0.2em] text-seafoam uppercase">
            <HeroEyebrow />
          </p>
          <h1 className="animate-rise-delay-1 font-heading max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-6xl md:text-7xl">
            Weekly Strategy
          </h1>
          <p className="animate-rise-delay-2 mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            <HeroDetail />
          </p>
          <div className="animate-rise-delay-2 mt-8 flex flex-wrap gap-3">
            <a
              href="#board"
              className="rounded-lg bg-seafoam px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              Open your board
            </a>
          </div>
        </section>

        <div id="board" className="scroll-mt-8">
          <WeeklyStrategyBoard />
          {process.env.NEXT_PUBLIC_APP_PROFILE === "blank" ? null : (
            <div id="cs234" className="scroll-mt-8">
              <Cs234Checklist />
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
