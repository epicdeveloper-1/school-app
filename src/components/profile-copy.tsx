"use client";

import { useSyncExternalStore } from "react";
import { isBlankProfile } from "@/lib/app-profile";
import { useHasPersonalFeatures } from "@/lib/personal-access";
import {
  personalHeroDetail,
  personalHeroEyebrow,
} from "@/lib/personal/labels";

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
  const personal = useHasPersonalFeatures();
  if (personal) return personalHeroEyebrow();
  return cloud ? "Your Google account" : "On this computer";
}

export function HeroDetail() {
  const cloud = useIsCloudProfile();
  const personal = useHasPersonalFeatures();
  if (personal) return personalHeroDetail();
  return cloud
    ? "Add your own tasks and dates. They are saved to your Google account."
    : "Add your own tasks and dates. Everything stays on this computer.";
}

export function SettingsIntro() {
  const cloud = useIsCloudProfile();
  if (cloud) {
    return "Customize how your planner works. Changes save to your Google account.";
  }
  if (isBlankProfile()) {
    return "Customize how your planner works. Changes save locally on this device.";
  }
  return "Customize how your planner works. Changes save on this device first; optional Google sync is below.";
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
