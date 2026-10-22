import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";
import { isTauri } from "@/core/fs";
import { useSettingsStore } from "@/stores/settingsStore";

type ResizeDirection =
  "North" | "South" | "East" | "West" | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

/**
 * Кнопки окна. Показываются только когда выбрана своя рамка:
 * с системной рамкой окном управляет ОС, и дублировать её кнопки незачем.
 */
export function WindowButtons() {
  const frame = useSettingsStore((state) => state.appearance.windowFrame);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri() || frame !== "custom") return;
    let alive = true;
    void (async () => {
      const win = await currentWindow();
      if (alive) setMaximized(await win.isMaximized());
      const unlisten = await win.onResized(async () => {
        if (alive) setMaximized(await win.isMaximized());
      });
      return unlisten;
    })();
    return () => {
      alive = false;
    };
  }, [frame]);

  if (!isTauri() || frame !== "custom") return null;

  const act = async (action: "minimize" | "toggle" | "close") => {
    const win = await currentWindow();
    if (action === "minimize") await win.minimize();
    if (action === "close") await win.close();
    if (action === "toggle") {
      await win.toggleMaximize();
      setMaximized(await win.isMaximized());
    }
  };

  return (
    <div className="no-drag ml-1 flex items-center gap-0.5">
      <button
        type="button"
        title="Свернуть"
        aria-label="Свернуть"
        onClick={() => void act("minimize")}
        className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        title={maximized ? "Восстановить" : "Развернуть"}
        aria-label={maximized ? "Восстановить" : "Развернуть"}
        onClick={() => void act("toggle")}
        className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
      >
        <Square size={12} />
      </button>
      <button
        type="button"
        title="Закрыть"
        aria-label="Закрыть"
        onClick={() => void act("close")}
        className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger hover:text-white"
      >
        <X size={15} />
      </button>
    </div>
  );
}

const EDGES: Array<{ dir: ResizeDirection; className: string }> = [
  { dir: "North", className: "left-2 right-2 top-0 h-1 cursor-ns-resize" },
  { dir: "South", className: "bottom-0 left-2 right-2 h-1 cursor-ns-resize" },
  { dir: "West", className: "bottom-2 left-0 top-2 w-1 cursor-ew-resize" },
  { dir: "East", className: "bottom-2 right-0 top-2 w-1 cursor-ew-resize" },
  { dir: "NorthWest", className: "left-0 top-0 size-2.5 cursor-nwse-resize" },
  { dir: "NorthEast", className: "right-0 top-0 size-2.5 cursor-nesw-resize" },
  { dir: "SouthWest", className: "bottom-0 left-0 size-2.5 cursor-nesw-resize" },
  { dir: "SouthEast", className: "bottom-0 right-0 size-2.5 cursor-nwse-resize" },
];

/**
 * Невидимые кромки для изменения размера. Нужны только своей рамке:
 * у окна без системных декораций ОС их не рисует.
 */
export function ResizeEdges() {
  const frame = useSettingsStore((state) => state.appearance.windowFrame);
  if (!isTauri() || frame !== "custom") return null;

  const start = (dir: ResizeDirection) => async (event: React.PointerEvent) => {
    event.preventDefault();
    const win = await currentWindow();
    await win.startResizeDragging(dir as never);
  };

  return (
    <>
      {EDGES.map((edge) => (
        <div
          key={edge.dir}
          onPointerDown={start(edge.dir)}
          className={`no-drag fixed z-50 ${edge.className}`}
          aria-hidden
        />
      ))}
    </>
  );
}

/**
 * Полоса, за которую окно перетаскивается, с кнопками окна справа.
 * Есть на каждом экране — в том числе на стартовом, иначе окно не подвинуть.
 */
export function DragBar({ title, children }: { title?: string; children?: React.ReactNode }) {
  const frame = useSettingsStore((state) => state.appearance.windowFrame);
  const showButtons = isTauri() && frame === "custom";
  return (
    <header
      data-tauri-drag-region
      className="drag-region flex h-9 shrink-0 items-center gap-1 border-b bg-panel px-2 hairline"
    >
      {children}
      <div className="pointer-events-none mx-2 flex min-w-0 flex-1 items-center justify-center">
        {title && <span className="truncate text-[12px] text-muted">{title}</span>}
      </div>
      {showButtons && <WindowButtons />}
    </header>
  );
}

/** Применить выбранный тип рамки к окну Tauri. */
export async function applyWindowFrame(frame: WindowFrameValue): Promise<void> {
  if (!isTauri()) return;
  try {
    const win = await currentWindow();
    await win.setDecorations(frame === "native");
  } catch {
    /* на мобильных платформах декораций нет */
  }
}

type WindowFrameValue = "native" | "custom";
