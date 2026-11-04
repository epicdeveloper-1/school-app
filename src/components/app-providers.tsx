"use client";

import type { ReactNode } from "react";
import { CloudSyncProvider } from "@/components/cloud-sync-provider";
import { LinkUrlPopoverHost } from "@/components/link-url-popover";
import { TagsProvider } from "@/components/tags-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <CloudSyncProvider>
      <TagsProvider>
        {children}
        <LinkUrlPopoverHost />
      </TagsProvider>
    </CloudSyncProvider>
  );
}
