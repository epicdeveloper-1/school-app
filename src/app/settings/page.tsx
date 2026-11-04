import type { ComponentType } from "react";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { SettingsIntro, SiteFooter } from "@/components/profile-copy";
import { CalendarSettingsPanel } from "@/components/calendar-settings-panel";
import { TagSettingsPanel } from "@/components/tag-settings-panel";

function NoAccountPanel() {
  return null;
}

let AccountPanel: ComponentType = NoAccountPanel;
if (process.env.NEXT_PUBLIC_APP_PROFILE === "blank") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AccountPanel = (require("@/components/blank-account-panel") as typeof import("@/components/blank-account-panel")).BlankAccountPanel;
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AccountPanel = (require("@/components/personal-account-panel") as typeof import("@/components/personal-account-panel")).PersonalAccountPanel;
}

export default function SettingsPage() {
  return (
    <div className="app-shell relative min-h-full flex-1">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 max-w-[50vw] animate-soft-pulse rounded-full bg-seafoam/20 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-6">
        <Link href="/" className="group inline-flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Weekly Strategy
          </span>
          <span className="hidden text-xs font-medium tracking-[0.18em] text-seafoam uppercase sm:inline">
            School
          </span>
        </Link>
        <AppNav />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <SettingsIntro />
        </p>

        <AccountPanel />

        <div className="mt-6 space-y-8">
          <CalendarSettingsPanel />
          <TagSettingsPanel />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
