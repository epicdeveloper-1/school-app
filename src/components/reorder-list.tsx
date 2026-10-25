"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type DropEdge = "before" | "after";
export type DropIndicator = { id: string; edge: DropEdge };

/** True when the drop slot is already the item’s current position (no-op). */
export function isNoOpDrop(
  orderedIds: string[],
  fromId: string,
  toId: string,
  edge: DropEdge,
): boolean {
  const from = orderedIds.indexOf(fromId);
  const to = orderedIds.indexOf(toId);
  if (from < 0 || to < 0 || fromId === toId) return true;
  if (edge === "before" && to === from + 1) return true;
  if (edge === "after" && to === from - 1) return true;
  return false;
}

export function reorderIds(
  orderedIds: string[],
  fromId: string,
  toId: string,
  edge: DropEdge,
): string[] | null {
  if (fromId === toId) return null;
  const fromIdx = orderedIds.indexOf(fromId);
  if (fromIdx < 0) return null;
  const next = [...orderedIds];
  const [item] = next.splice(fromIdx, 1);
  let insertIdx = next.indexOf(toId);
  if (insertIdx < 0) return null;
  if (edge === "after") insertIdx += 1;
  next.splice(insertIdx, 0, item);
  return next;
}

export function DropGap({
  open,
  height,
  className,
}: {
  open: boolean;
  height: number;
  className?: string;
}) {
  const h = Math.max(height, 36);
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none overflow-hidden transition-[height,margin,opacity] duration-200 ease-out",
        className,
      )}
      style={{
        height: open ? h : 0,
        marginTop: open ? 4 : 0,
        marginBottom: open ? 4 : 0,
        opacity: open ? 1 : 0,
      }}
    >
      <div className="box-border h-full rounded-lg border-2 border-ink/70 bg-transparent" />
    </div>
  );
}

type DragFloat = {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  html: string;
};

type ReorderRowProps = {
  rowId: string;
  label: string;
  isMoving: boolean;
  dragId: string | null;
  dragHeight: number;
  dropIndicator: DropIndicator | null;
  orderedIds: string[];
  setDragId: (id: string | null) => void;
  setDragHeight: (height: number) => void;
  setDropIndicator: Dispatch<SetStateAction<DropIndicator | null>>;
  onReorder: (fromId: string, toId: string, edge: DropEdge) => void;
  /** Shown beside the grip while move mode is on (e.g. up/down arrows). */
  moveControls?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Extra classes for the outer wrapper when this row is the drag source. */
  draggingClassName?: string;
  onContextMenu?: (event: ReactMouseEvent<HTMLLIElement>) => void;
};

function hitTestRow(
  clientX: number,
  clientY: number,
  selfId: string,
): { id: string; edge: DropEdge } | null {
  const els = document.elementsFromPoint(clientX, clientY);
  for (const el of els) {
    if (!(el instanceof HTMLElement)) continue;
    const row = el.closest("[data-reorder-row]") as HTMLElement | null;
    if (!row) continue;
    const id = row.dataset.reorderRow;
    if (!id || id === selfId) continue;
    const rect = row.getBoundingClientRect();
    const edge: DropEdge =
      clientY < rect.top + rect.height / 2 ? "before" : "after";
    return { id, edge };
  }
  return null;
}

export function ReorderRow({
  rowId,
  label,
  isMoving,
  dragId,
  dragHeight,
  dropIndicator,
  orderedIds,
  setDragId,
  setDragHeight,
  setDropIndicator,
  onReorder,
  moveControls,
  children,
  className,
  draggingClassName,
  onContextMenu,
}: ReorderRowProps) {
  const rowRef = useRef<HTMLLIElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [float, setFloat] = useState<DragFloat | null>(null);
  const dropRef = useRef(dropIndicator);
  const orderedIdsRef = useRef(orderedIds);
  const onReorderRef = useRef(onReorder);
  const activeRef = useRef(false);

  useEffect(() => {
    dropRef.current = dropIndicator;
  }, [dropIndicator]);
  useEffect(() => {
    orderedIdsRef.current = orderedIds;
  }, [orderedIds]);
  useEffect(() => {
    onReorderRef.current = onReorder;
  }, [onReorder]);

  const isDragging = dragId === rowId;
  const gapBefore =
    isMoving &&
    dropIndicator?.id === rowId &&
    dropIndicator.edge === "before" &&
    dragId != null &&
    dragId !== rowId &&
    !isNoOpDrop(orderedIds, dragId, rowId, "before");
  const gapAfter =
    isMoving &&
    dropIndicator?.id === rowId &&
    dropIndicator.edge === "after" &&
    dragId != null &&
    dragId !== rowId &&
    !isNoOpDrop(orderedIds, dragId, rowId, "after");

  function clearDrag() {
    activeRef.current = false;
    setFloat(null);
    setDragId(null);
    setDragHeight(0);
    setDropIndicator(null);
  }

  function onGripPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!isMoving || e.button !== 0) return;
    const row = rowRef.current;
    const content = contentRef.current;
    if (!row || !content) return;

    e.preventDefault();
    e.stopPropagation();
    activeRef.current = true;

    const rect = row.getBoundingClientRect();
    const height = rect.height;
    setDragHeight(height);
    setDragId(rowId);
    setDropIndicator(null);

    setFloat({
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      html: content.innerHTML,
    });

    const pointerId = e.pointerId;
    const target = e.currentTarget;
    target.setPointerCapture(pointerId);

    const onMove = (ev: PointerEvent) => {
      if (!activeRef.current || ev.pointerId !== pointerId) return;
      setFloat((cur) =>
        cur ? { ...cur, x: ev.clientX, y: ev.clientY } : cur,
      );
      const hit = hitTestRow(ev.clientX, ev.clientY, rowId);
      if (!hit) return;
      setDropIndicator((cur) =>
        cur?.id === hit.id && cur.edge === hit.edge ? cur : hit,
      );
    };

    const onUp = (ev: PointerEvent) => {
      if (!activeRef.current || ev.pointerId !== pointerId) return;
      const fromId = rowId;
      const hit =
        dropRef.current ?? hitTestRow(ev.clientX, ev.clientY, fromId);

      try {
        target.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);

      const ids = orderedIdsRef.current;
      if (
        hit &&
        !isNoOpDrop(ids, fromId, hit.id, hit.edge)
      ) {
        onReorderRef.current(fromId, hit.id, hit.edge);
      }
      clearDrag();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  return (
    <li
      ref={rowRef}
      data-reorder-row={rowId}
      onContextMenu={onContextMenu}
      className={cn(
        "relative list-none transition-[opacity,transform,box-shadow] duration-200 ease-out",
        isDragging &&
          (draggingClassName ??
            "rounded-lg border-2 border-ink/70 bg-transparent opacity-35 shadow-none"),
        className,
      )}
    >
      <DropGap open={gapBefore} height={dragHeight} />
      <div
        className={cn(
          "flex min-w-0 items-center gap-1",
          isMoving && "pl-1.5 pr-1",
        )}
      >
        {isMoving && (
          <div className="flex shrink-0 items-center self-center">
            {moveControls}
            <button
              type="button"
              aria-label={`Drag to reorder ${label}`}
              onPointerDown={onGripPointerDown}
              className={cn(
                "flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground select-none",
                "hover:bg-secondary/60 hover:text-ink active:cursor-grabbing",
                isDragging && "cursor-grabbing",
              )}
            >
              <GripVertical className="size-4 pointer-events-none" aria-hidden />
            </button>
          </div>
        )}
        <div
          ref={contentRef}
          className={cn(
            "min-w-0 flex-1",
            isDragging && "pointer-events-none opacity-40",
          )}
        >
          {children}
        </div>
      </div>
      <DropGap open={gapAfter} height={dragHeight} />

      {float &&
        isDragging &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[500] overflow-hidden rounded-lg border-2 border-ink bg-white shadow-md"
            style={{
              left: float.x - float.offsetX,
              top: float.y - float.offsetY,
              width: float.width,
              height: float.height,
              boxSizing: "border-box",
            }}
          >
            <div
              className="flex h-full min-w-0 items-center gap-1 px-1.5 opacity-95"
              dangerouslySetInnerHTML={{ __html: float.html }}
            />
          </div>,
          document.body,
        )}
    </li>
  );
}
