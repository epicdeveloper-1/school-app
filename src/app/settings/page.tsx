import type { ComponentType } from "react";
import { AppNav } from "@/components/app-nav";
import { SettingsIntro, SiteFooter } from "@/components/profile-copy";
import { TagSettingsPanel } from "@/components/tag-settings-panel";

function NoCloudAccount() {
  return null;
}

let BlankAccountPanel: ComponentType = NoCloudAccount;
if (process.env.NEXT_PUBLIC_APP_PROFILE === "blank") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BlankAccountPanel = (require("@/components/blank-account-panel") as typeof import("@/components/blank-account-panel")).BlankAccountPanel;
}

export default function SettingsPage() {
  return (
    <div className="app-shell relative min-h-full flex-1">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 max-w-[50vw] animate-soft-pulse rounded-full bg-seafoam/20 blur-3xl" />

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

      <main className="relative z-10 mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <SettingsIntro />
        </p>

        {process.env.NEXT_PUBLIC_APP_PROFILE === "blank" ? <BlankAccountPanel /> : null}

        <div className="mt-6">
          <TagSettingsPanel />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
