"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ChevronDown, Move, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropIndicator,
  ReorderRow,
} from "@/components/reorder-list";
import { useTags } from "@/components/tags-provider";
import { TAG_COLOR_PRESETS } from "@/lib/tag-registry";
import type { BoxTagMeta } from "@/lib/box-tags";

function TagPreview({ meta }: { meta: Pick<BoxTagMeta, "label" | "color"> }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-white/80 px-2.5 py-1.5">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Preview
      </span>
      <span className="text-sm">
        <span style={{ color: meta.color }} className="font-semibold">
          {meta.label}
        </span>
        <span className="font-semibold text-muted-foreground"> | </span>
        <span className="text-ink">Task text…</span>
      </span>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Color</p>
      <div className="flex flex-wrap gap-1">
        {TAG_COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Use color ${c}`}
            onClick={() => onChange(c)}
            className={`size-6 rounded-md border-2 transition-transform hover:scale-105 ${
              value.toLowerCase() === c.toLowerCase()
                ? "border-ink ring-2 ring-seafoam/40"
                : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <span
            className="size-7 shrink-0 overflow-hidden rounded-md border border-border shadow-inner"
            style={{ backgroundColor: value }}
          >
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="size-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-0 bg-transparent p-0"
              aria-label="Pick custom color"
            />
          </span>
          Custom
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 max-w-[7rem] font-mono text-xs"
          aria-label="Hex color"
        />
      </div>
    </div>
  );
}

function TagEditorFields({
  meta,
  onSave,
  onDelete,
  canDelete,
}: {
  meta: BoxTagMeta;
  onSave: (patch: Partial<Pick<BoxTagMeta, "label" | "color">>) => Promise<void>;
  onDelete: () => Promise<void>;
  canDelete: boolean;
}) {
  const [label, setLabel] = useState(meta.label);
  const [color, setColor] = useState(meta.color);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setLabel(meta.label);
    setColor(meta.color);
    setConfirmDelete(false);
  }, [meta.id, meta.label, meta.color]);

  const dirty = label.trim() !== meta.label || color !== meta.color;
  const preview = useMemo(
    () => ({ label: label.trim() || meta.label, color }),
    [label, meta.label, color],
  );

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      await onSave({ label: label.trim(), color });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 h-8"
        />
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <TagPreview meta={preview} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || saving || !label.trim()}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        {canDelete &&
          (confirmDelete ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void onDelete()}
            >
              Confirm delete
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          ))}
      </div>
    </div>
  );
}

function CompactTagRow({
  meta,
  expanded,
  onToggle,
  onSave,
  onDelete,
  canDelete,
  isMoving,
  dragId,
  dragHeight,
  dropIndicator,
  orderedIds,
  setDragId,
  setDragHeight,
  setDropIndicator,
  onReorder,
}: {
  meta: BoxTagMeta;
  expanded: boolean;
  onToggle: () => void;
  onSave: (patch: Partial<Pick<BoxTagMeta, "label" | "color">>) => Promise<void>;
  onDelete: () => Promise<void>;
  canDelete: boolean;
  isMoving: boolean;
  dragId: string | null;
  dragHeight: number;
  dropIndicator: DropIndicator | null;
  orderedIds: string[];
  setDragId: (id: string | null) => void;
  setDragHeight: (height: number) => void;
  setDropIndicator: Dispatch<SetStateAction<DropIndicator | null>>;
  onReorder: (fromId: string, toId: string, edge: "before" | "after") => void;
}) {
  return (
    <ReorderRow
      rowId={meta.id}
      label={meta.label}
      isMoving={isMoving}
      dragId={dragId}
      dragHeight={dragHeight}
      dropIndicator={dropIndicator}
      orderedIds={orderedIds}
      setDragId={setDragId}
      setDragHeight={setDragHeight}
      setDropIndicator={setDropIndicator}
      onReorder={onReorder}
      className="border-b border-border/50 last:border-b-0"
      draggingClassName="border-b border-border/50 bg-transparent opacity-40 last:border-b-0"
    >
      <div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full min-w-0 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-secondary/40"
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: meta.color }}
            aria-hidden
          />
          <span
            className="min-w-0 flex-1 truncate text-sm font-medium"
            style={{ color: meta.color }}
          >
            {meta.label}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>
        {expanded && (
          <TagEditorFields
            meta={meta}
            onSave={onSave}
            onDelete={onDelete}
            canDelete={canDelete}
          />
        )}
      </div>
    </ReorderRow>
  );
}

export function TagSettingsPanel() {
  const { tags, ready, addTag, updateTag, deleteTag, reorderTag } = useTags();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>(TAG_COLOR_PRESETS[2]);
  const [adding, setAdding] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragHeight, setDragHeight] = useState(0);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null,
  );

  const orderedIds = useMemo(() => tags.map((t) => t.id), [tags]);

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    setAdding(true);
    try {
      await addTag(label, newColor);
      setNewLabel("");
      setAddingOpen(false);
    } finally {
      setAdding(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Loading tags…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold text-ink">Tags</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isMoving
              ? "Drag the dots to reorder — that order is used on multi-tag boxes."
              : "Click Move to reorder. Click a tag to rename, recolor, or delete it."}
          </p>
        </div>
        {tags.length > 1 && (
          <Button
            type="button"
            variant={isMoving ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setIsMoving((v) => !v);
              setDragId(null);
              setDragHeight(0);
              setDropIndicator(null);
            }}
            aria-pressed={isMoving}
            className="h-7 shrink-0 gap-1 px-2 text-xs"
          >
            <Move className="size-3.5" />
            {isMoving ? "Done" : "Move"}
          </Button>
        )}
      </div>

      <ul
        className={`rounded-xl border border-border/70 bg-card/90 ${
          isMoving ? "overflow-visible" : "overflow-hidden"
        }`}
      >
        {tags.map((meta) => (
          <CompactTagRow
            key={meta.id}
            meta={meta}
            expanded={expandedId === meta.id}
            onToggle={() =>
              setExpandedId((id) => (id === meta.id ? null : meta.id))
            }
            canDelete={meta.id !== "optional"}
            isMoving={isMoving}
            dragId={dragId}
            dragHeight={dragHeight}
            dropIndicator={dropIndicator}
            orderedIds={orderedIds}
            setDragId={setDragId}
            setDragHeight={setDragHeight}
            setDropIndicator={setDropIndicator}
            onReorder={(fromId, toId, edge) =>
              void reorderTag(fromId, toId, edge)
            }
            onSave={(patch) => updateTag(meta.id, patch)}
            onDelete={async () => {
              await deleteTag(meta.id);
              setExpandedId(null);
            }}
          />
        ))}
      </ul>

      <div className="overflow-hidden rounded-xl border border-dashed border-border/80 bg-white/50">
        <button
          type="button"
          onClick={() => setAddingOpen((v) => !v)}
          aria-expanded={addingOpen}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-secondary/40"
        >
          <Plus className="size-3.5 text-seafoam" />
          Add tag
          <ChevronDown
            className={`ml-auto size-4 text-muted-foreground transition-transform ${
              addingOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>
        {addingOpen && (
          <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. PHIL 101"
                className="mt-1 h-8"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAdd();
                }}
              />
            </div>
            <ColorPicker value={newColor} onChange={setNewColor} />
            {newLabel.trim() && (
              <TagPreview meta={{ label: newLabel.trim(), color: newColor }} />
            )}
            <Button
              type="button"
              size="sm"
              disabled={!newLabel.trim() || adding}
              onClick={() => void handleAdd()}
            >
              <Plus className="size-3.5" />
              {adding ? "Adding…" : "Add tag"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
