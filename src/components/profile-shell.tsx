"use client";

import type { ComponentType, ReactNode } from "react";
import { AppProviders } from "@/components/app-providers";

function LocalShell({ children }: { children: ReactNode }) {
  return children;
}

let BlankAuthGate: ComponentType<{ children: ReactNode }> = LocalShell;
if (process.env.NEXT_PUBLIC_APP_PROFILE === "blank") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BlankAuthGate = (require("@/components/blank-auth-gate") as typeof import("@/components/blank-auth-gate")).BlankAuthGate;
}

export function ProfileShell({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_APP_PROFILE !== "blank") {
    return <AppProviders>{children}</AppProviders>;
  }

  return (
    <BlankAuthGate>
      <AppProviders>{children}</AppProviders>
    </BlankAuthGate>
  );
}
