"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BoxTagMeta } from "@/lib/box-tags";
import { defaultBoxTags, setRuntimeBoxTags } from "@/lib/box-tags";
import {
  createTagMeta,
  loadTagRegistry,
  persistTagRegistry,
} from "@/lib/tag-registry";
import {
  purgeTagFromAllData,
  replaceTagLabelInAllData,
} from "@/lib/tag-data-sync";
import { reorderIds } from "@/components/reorder-list";

type TagsContextValue = {
  tags: BoxTagMeta[];
  ready: boolean;
  refresh: () => Promise<void>;
  addTag: (label: string, color: string) => Promise<void>;
  updateTag: (
    id: string,
    patch: Partial<Pick<BoxTagMeta, "label" | "prefix" | "color">>,
  ) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  /** Move a tag one step toward the start (-1) or end (+1) of the list. */
  moveTag: (id: string, delta: -1 | 1) => Promise<void>;
  /** Drag-reorder: place `fromId` before/after `toId`. */
  reorderTag: (
    fromId: string,
    toId: string,
    edge: "before" | "after",
  ) => Promise<void>;
};

const TagsContext = createContext<TagsContextValue | null>(null);

export function TagsProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<BoxTagMeta[]>(defaultBoxTags());
  const [ready, setReady] = useState(false);

  const applyTags = useCallback((next: BoxTagMeta[]) => {
    setRuntimeBoxTags(next);
    setTags([...next]);
  }, []);

  const refresh = useCallback(async () => {
    const loaded = await loadTagRegistry();
    applyTags(loaded);
    setReady(true);
  }, [applyTags]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTag = useCallback(
    async (label: string, color: string) => {
      const meta = createTagMeta(label, color, tags);
      const next = [...tags, meta];
      await persistTagRegistry(next);
      applyTags(next);
    },
    [applyTags, tags],
  );

  const updateTag = useCallback(
    async (
      id: string,
      patch: Partial<Pick<BoxTagMeta, "label" | "prefix" | "color">>,
    ) => {
      const idx = tags.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const current = tags[idx];
      const label = (patch.label ?? current.label).trim();
      const prefix = (patch.prefix ?? patch.label ?? current.prefix).trim();
      const color = patch.color ?? current.color;

      if (label !== current.label) {
        await replaceTagLabelInAllData(current.label, label);
      }

      const next = tags.map((t) =>
        t.id === id
          ? { ...t, label, prefix: prefix || label, color }
          : t,
      );
      await persistTagRegistry(next);
      applyTags(next);
    },
    [applyTags, tags],
  );

  const deleteTag = useCallback(
    async (id: string) => {
      if (id === "optional") return;
      await purgeTagFromAllData(id);
      const next = tags.filter((t) => t.id !== id);
      await persistTagRegistry(next);
      applyTags(next);
    },
    [applyTags, tags],
  );

  const moveTag = useCallback(
    async (id: string, delta: -1 | 1) => {
      const from = tags.findIndex((t) => t.id === id);
      if (from < 0) return;
      const to = from + delta;
      if (to < 0 || to >= tags.length) return;
      const next = [...tags];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      await persistTagRegistry(next);
      applyTags(next);
    },
    [applyTags, tags],
  );

  const reorderTag = useCallback(
    async (fromId: string, toId: string, edge: "before" | "after") => {
      const ids = tags.map((t) => t.id);
      const nextIds = reorderIds(ids, fromId, toId, edge);
      if (!nextIds) return;
      const byId = new Map(tags.map((t) => [t.id, t]));
      const next = nextIds
        .map((id) => byId.get(id))
        .filter((t): t is BoxTagMeta => t != null);
      if (next.length !== tags.length) return;
      await persistTagRegistry(next);
      applyTags(next);
    },
    [applyTags, tags],
  );

  const value = useMemo(
    () => ({
      tags,
      ready,
      refresh,
      addTag,
      updateTag,
      deleteTag,
      moveTag,
      reorderTag,
    }),
    [tags, ready, refresh, addTag, updateTag, deleteTag, moveTag, reorderTag],
  );

  if (!ready) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <TagsContext.Provider value={value}>{children}</TagsContext.Provider>
  );
}

export function useTags(): TagsContextValue {
  const ctx = useContext(TagsContext);
  if (!ctx) {
    throw new Error("useTags must be used within TagsProvider");
  }
  return ctx;
}
