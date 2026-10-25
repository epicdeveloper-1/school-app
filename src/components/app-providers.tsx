"use client";

import type { ReactNode } from "react";
import { TagsProvider } from "@/components/tags-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <TagsProvider>{children}</TagsProvider>;
}
