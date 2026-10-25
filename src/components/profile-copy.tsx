"use client";

import { useSyncExternalStore } from "react";
import { isBlankProfile } from "@/lib/app-profile";

function subscribeDesktopBridge(): () => void {
  return () => {};
}

function hasDesktopBridge(): boolean {
  return Boolean(window.weeklyStrategy?.getItem);
}

/** True only for the blank website. Electron keeps the local copy. */
export function useIsCloudProfile(): boolean {
  const desktop = useSyncExternalStore(
    subscribeDesktopBridge,
    hasDesktopBridge,
    () => false,
  );
  return isBlankProfile() && !desktop;
}

export function HeroEyebrow() {
  const cloud = useIsCloudProfile();
  if (process.env.NEXT_PUBLIC_APP_PROFILE === "blank") {
    return cloud ? "Your Google account" : "On this computer";
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/personal/labels").personalHeroEyebrow();
}

export function HeroDetail() {
  const cloud = useIsCloudProfile();
  if (process.env.NEXT_PUBLIC_APP_PROFILE === "blank") {
    return cloud
      ? "Add your own tasks and dates. They are saved to your Google account."
      : "Add your own tasks and dates. Everything stays on this computer.";
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/personal/labels").personalHeroDetail();
}

export function SettingsIntro() {
  const cloud = useIsCloudProfile();
  if (cloud) {
    return "Customize how your planner works. Changes save to your Google account.";
  }
  return "Customize how your planner works. Changes save locally on this device.";
}

export function SiteFooter() {
  const cloud = useIsCloudProfile();
  return (
    <footer className="relative z-0 border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
      {cloud
        ? "Weekly Strategy — saved to your Google account."
        : "Weekly Strategy — a local school week planner. No account required."}
    </footer>
  );
}
