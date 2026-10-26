"use client";

import type { ReactNode } from "react";
import { LinkUrlPopoverHost } from "@/components/link-url-popover";
import { TagsProvider } from "@/components/tags-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TagsProvider>
      {children}
      <LinkUrlPopoverHost />
    </TagsProvider>
  );
}
