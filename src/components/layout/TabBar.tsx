import { useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useDragStore } from "@/stores/dragStore";
import type { DropZone } from "@/core/layout";
import { specialTabTitle } from "@/core/views";

const DRAG_THRESHOLD = 5;
const EDGE_RATIO = 0.22;

/** Строка вкладок одной панели. Вкладки можно тянуть мышью — внутри панели и между ними. */
export function TabBar({ paneId }: { paneId: string }) {
  const pane = useEditorStore((state) => state.panes[paneId]);
  const activePane = useEditorStore((state) => state.activePane);
  const dirty = useEditorStore((state) => state.dirty);
  const notes = useVaultStore((state) => state.manager?.notes);
  const drag = useDragStore();
  const strip = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!drag.path) return;
    const move = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const paneElement = element?.closest<HTMLElement>("[data-fn-pane]");
      if (!paneElement) {
        drag.move(event.clientX, event.clientY, null);
        return;
      }
      const targetPane = paneElement.dataset.fnPane as string;
      const rect = paneElement.getBoundingClientRect();
      const stripElement = element?.closest<HTMLElement>("[data-fn-tabstrip]");

      if (stripElement) {
        // Над строкой вкладок — вставка между вкладками
        const tabs = [...stripElement.querySelectorAll<HTMLElement>("[data-fn-tab]")];
        let index = tabs.length;
        for (const [position, tab] of tabs.entries()) {
          const tabRect = tab.getBoundingClientRect();
          if (event.clientX < tabRect.left + tabRect.width / 2) {
            index = position;
            break;
          }
        }
        drag.move(event.clientX, event.clientY, { paneId: targetPane, zone: "center", index });
        return;
      }

      const relX = (event.clientX - rect.left) / rect.width;
      const relY = (event.clientY - rect.top) / rect.height;
      let zone: DropZone = "center";
      const edge = Math.min(relX, 1 - relX, relY, 1 - relY);
      if (edge < EDGE_RATIO) {
        if (edge === relX) zone = "left";
        else if (edge === 1 - relX) zone = "right";
        else if (edge === relY) zone = "top";
        else zone = "bottom";
      }
      drag.move(event.clientX, event.clientY, { paneId: targetPane, zone });
    };

    const up = () => {
      const { path, fromPane, target } = useDragStore.getState();
      if (path && fromPane && target) {
        useEditorStore.getState().dropTab(path, fromPane, target.paneId, target.zone, target.index);
      }
      drag.end();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag]);

  if (!pane) return null;

  const startDrag = (path: string) => (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const begin = (moveEvent: PointerEvent) => {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) return;
      useDragStore.getState().start(path, paneId, moveEvent.clientX, moveEvent.clientY);
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", begin);
      window.removeEventListener("pointerup", cleanup);
    };
    window.addEventListener("pointermove", begin);
    window.addEventListener("pointerup", cleanup);
  };

  const insertionIndex =
    drag.path && drag.target?.paneId === paneId && drag.target.zone === "center"
      ? drag.target.index
      : undefined;

  return (
    <div
      ref={strip}
      data-fn-tabstrip={paneId}
      className={`flex h-9 shrink-0 items-stretch gap-0.5 overflow-x-auto border-b px-1 hairline ${
        activePane === paneId ? "bg-panel" : "bg-canvas"
      }`}
    >
      {pane.tabs.map((path, index) => {
        const title = specialTabTitle(path) ?? notes?.get(path)?.title ?? path.split("/").pop() ?? path;
        const isActive = path === pane.active;
        return (
          <div key={path} className="flex items-stretch">
            {insertionIndex === index && <span className="my-1.5 w-0.5 rounded bg-accent" />}
            <div
              data-fn-tab={path}
              onPointerDown={startDrag(path)}
              className={`group flex min-w-0 max-w-56 items-center gap-1 rounded-t-lg px-2 text-[13px] ${
                isActive ? "bg-panel text-ink" : "text-muted hover:bg-hover"
              } ${drag.path === path ? "opacity-40" : ""}`}
              style={{ touchAction: "pan-x" }}
            >
              <button
                type="button"
                onClick={() => useEditorStore.getState().setActive(path, paneId)}
                className="min-w-0 flex-1 truncate py-1 text-left"
              >
                {title}
                {dirty[path] && <span className="ml-1 text-accent">•</span>}
              </button>
              <button
                type="button"
                aria-label="Закрыть вкладку"
                onClick={() => void useEditorStore.getState().closeTab(path, paneId)}
                className="shrink-0 rounded p-0.5 text-muted opacity-0 hover:bg-hover hover:text-ink group-hover:opacity-100"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        );
      })}
      {insertionIndex === pane.tabs.length && <span className="my-1.5 w-0.5 rounded bg-accent" />}
      <button
        type="button"
        aria-label="Новая заметка"
        title="Новая заметка"
        onClick={async () => {
          const vault = useVaultStore.getState();
          const created = await vault.createNote();
          if (created) await useEditorStore.getState().openNote(created, { pane: paneId });
        }}
        className="my-1 ml-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

/** Полупрозрачный ярлык, который едет за курсором во время перетаскивания. */
export function TabDragGhost() {
  const { path, x, y } = useDragStore();
  const notes = useVaultStore((state) => state.manager?.notes);
  if (!path) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-lg border bg-panel px-2 py-1 text-[12.5px] text-ink hairline panel-shadow"
      style={{ left: x + 12, top: y + 10 }}
    >
      {specialTabTitle(path) ?? notes?.get(path)?.title ?? path}
    </div>
  );
}
