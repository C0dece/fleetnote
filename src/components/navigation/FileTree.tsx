import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pin,
  PinOff,
  SquareDashedMousePointer,
} from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDialogStore } from "@/components/ui/dialogs";
import { basename, dirname, stem } from "@/core/fs/paths";

interface Row {
  path: string;
  name: string;
  isDir: boolean;
  isCanvas?: boolean;
  depth: number;
  expanded?: boolean;
  mtime?: number;
  tasks?: { total: number; done: number };
}

const OVERSCAN = 8;
const DRAG_THRESHOLD = 6;
const AUTO_EXPAND_MS = 600;

/**
 * Дерево базы: виртуализация ради больших баз, перетаскивание мышью и пальцем,
 * закреплённые заметки сверху. Все действия доступны и из меню «…», и правым кликом.
 */
export function FileTree({ touch = false }: { touch?: boolean }) {
  const notes = useVaultStore((state) => state.notes);
  const revision = useVaultStore((state) => state.revision);
  const manager = useVaultStore((state) => state.manager);
  const pins = useVaultStore((state) => state.pins);
  const moveEntry = useVaultStore((state) => state.moveEntry);
  const openNote = useEditorStore((state) => state.openNote);
  const active = useEditorStore((state) => state.active);
  const setSheet = useUIStore((state) => state.setSheet);
  const vaultSettings = useSettingsStore((state) => state.vault);
  const rowHeight = useSettingsStore((state) =>
    touch ? state.mobile.touchRowHeight : Math.round(30 * state.appearance.uiScale),
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(480);
  const [menu, setMenu] = useState<{ path: string; isDir: boolean; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ path: string; x: number; y: number; over: string | null } | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const autoExpand = useRef<{ path: string; at: number } | null>(null);

  const rows = useMemo(() => {
    void revision;
    const folders = new Set<string>(manager?.folders ?? []);
    for (const note of notes) {
      let dir = dirname(note.path);
      while (dir) {
        folders.add(dir);
        dir = dirname(dir);
      }
    }
    const children = new Map<string, Row[]>();
    const push = (parent: string, row: Row) => {
      const list = children.get(parent) ?? [];
      list.push(row);
      children.set(parent, list);
    };
    for (const folder of folders) {
      push(dirname(folder), { path: folder, name: basename(folder), isDir: true, depth: 0 });
    }
    for (const canvas of manager?.otherFiles ?? []) {
      if (!canvas.toLowerCase().endsWith(".canvas")) continue;
      push(dirname(canvas), {
        path: canvas,
        name: basename(canvas).replace(/\.canvas$/i, ""),
        isDir: false,
        isCanvas: true,
        depth: 0,
      });
    }
    for (const note of notes) {
      push(dirname(note.path), {
        path: note.path,
        name: vaultSettings.showFileExtensions ? basename(note.path) : note.title || stem(note.path),
        isDir: false,
        depth: 0,
        mtime: note.mtime,
        tasks: note.tasks,
      });
    }
    const compare = (a: Row, b: Row) => {
      if (a.isDir !== b.isDir) return Number(b.isDir) - Number(a.isDir);
      const byName = a.name.localeCompare(b.name, "ru");
      const value = vaultSettings.sortBy === "name" ? byName : (b.mtime ?? 0) - (a.mtime ?? 0) || byName;
      return vaultSettings.sortDesc ? -value : value;
    };
    for (const list of children.values()) list.sort(compare);

    const flat: Row[] = [];
    const walk = (parent: string, depth: number) => {
      for (const row of children.get(parent) ?? []) {
        const expanded = row.isDir ? !collapsed.has(row.path) : undefined;
        flat.push({ ...row, depth, expanded });
        if (row.isDir && expanded) walk(row.path, depth + 1);
      }
    };
    walk("", 0);
    return flat;
  }, [notes, manager, collapsed, revision, vaultSettings]);

  const measure = useCallback((node: HTMLDivElement | null) => {
    viewport.current = node;
    if (node) setHeight(node.clientHeight || 480);
  }, []);

  const toggle = useCallback((path: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Перетаскивание на указателях: одинаково работает мышью и пальцем.
  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const target = element?.closest<HTMLElement>("[data-fn-drop]")?.dataset.fnDrop ?? null;
      setDrag((current) =>
        current ? { ...current, x: event.clientX, y: event.clientY, over: target } : null,
      );

      // Наведение на свёрнутую папку её разворачивает — иначе вглубь не положить
      if (target && target !== autoExpand.current?.path) {
        autoExpand.current = { path: target, at: Date.now() };
      } else if (target && autoExpand.current && Date.now() - autoExpand.current.at > AUTO_EXPAND_MS) {
        setCollapsed((previous) => {
          if (!previous.has(target)) return previous;
          const next = new Set(previous);
          next.delete(target);
          return next;
        });
        autoExpand.current = null;
      }
    };
    const up = () => {
      const current = drag;
      setDrag(null);
      autoExpand.current = null;
      if (!current || current.over === null) return;
      if (current.over === dirname(current.path)) return;
      void moveEntry(current.path, current.over);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, moveEntry]);

  const startDrag = (path: string) => (event: React.PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const startX = event.clientX;
    const startY = event.clientY;
    const begin = (moveEvent: PointerEvent) => {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) return;
      setDrag({ path, x: moveEvent.clientX, y: moveEvent.clientY, over: null });
      window.removeEventListener("pointermove", begin);
    };
    const stop = () => {
      window.removeEventListener("pointermove", begin);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", begin);
    window.addEventListener("pointerup", stop);
  };

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const slice = rows.slice(first, first + Math.ceil(height / rowHeight) + OVERSCAN * 2);
  const pinnedRows = pins
    .map((path) => ({ path, title: manager?.notes.get(path)?.title ?? basename(path) }))
    .filter((item) => manager?.notes.has(item.path));

  const openRow = (row: Row) => {
    if (row.isDir) {
      toggle(row.path);
      return;
    }
    void openNote(row.path);
    setSheet("none");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {pinnedRows.length > 0 && (
        <div className="border-b px-1 pb-1 hairline">
          <div className="px-2 py-1 text-[10.5px] uppercase tracking-wide text-muted">Закреплённые</div>
          {pinnedRows.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                void openNote(item.path);
                setSheet("none");
              }}
              style={{ height: rowHeight }}
              className={`flex w-full items-center gap-1.5 rounded-lg px-2 text-left text-[13.5px] hover:bg-hover ${
                item.path === active ? "bg-accent-soft text-ink" : "text-muted"
              }`}
            >
              <Pin size={13} className="shrink-0 text-accent" />
              <span className="truncate">{item.title}</span>
            </button>
          ))}
        </div>
      )}

      <div
        ref={measure}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        onContextMenu={(event) => {
          if ((event.target as HTMLElement).closest("[data-fn-row]")) return;
          event.preventDefault();
          setMenu({ path: "", isDir: true, x: event.clientX, y: event.clientY });
        }}
        data-fn-drop=""
        className={`min-h-0 flex-1 overflow-y-auto px-1 ${
          drag && drag.over === "" ? "bg-accent-soft/40" : ""
        }`}
      >
        <div style={{ height: Math.max(rows.length * rowHeight, 1), position: "relative" }}>
          {slice.map((row, index) => {
            const top = (first + index) * rowHeight;
            const isActive = row.path === active;
            const isDropTarget = drag?.over === row.path && row.isDir && drag.path !== row.path;
            return (
              <div
                key={row.path}
                data-fn-row={row.path}
                data-fn-drop={row.isDir ? row.path : dirname(row.path)}
                style={{ position: "absolute", top, height: rowHeight, left: 0, right: 0 }}
                className={`group flex items-center rounded-lg ${isDropTarget ? "ring-1 ring-[var(--fn-accent)]" : ""} ${
                  drag?.path === row.path ? "opacity-40" : ""
                }`}
              >
                <button
                  type="button"
                  onPointerDown={startDrag(row.path)}
                  onClick={() => openRow(row)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ path: row.path, isDir: row.isDir, x: event.clientX, y: event.clientY });
                  }}
                  className={`flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-lg pr-1 text-left text-[13.5px] transition-colors hover:bg-hover ${
                    isActive ? "bg-accent-soft text-ink" : "text-muted"
                  }`}
                  style={{ paddingLeft: 6 + row.depth * 14, touchAction: "pan-y" }}
                >
                  {row.isDir ? (
                    <>
                      {row.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {row.expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                    </>
                  ) : row.isCanvas ? (
                    <SquareDashedMousePointer size={15} className="ml-3.5 shrink-0 text-accent opacity-80" />
                  ) : (
                    <FileText size={15} className="ml-3.5 shrink-0 opacity-70" />
                  )}
                  <span className={`truncate ${isActive ? "text-ink" : ""}`}>{row.name}</span>
                  {pins.includes(row.path) && <Pin size={11} className="shrink-0 text-accent" />}
                  {row.tasks && row.tasks.total > 0 && (
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted">
                      {row.tasks.done}/{row.tasks.total}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Действия"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({ path: row.path, isDir: row.isDir, x: rect.left - 150, y: rect.bottom + 4 });
                  }}
                  className={`mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover ${
                    touch ? "" : "opacity-0 focus:opacity-100 group-hover:opacity-100"
                  }`}
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {drag && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border bg-panel px-2 py-1 text-[12.5px] text-ink hairline panel-shadow"
          style={{ left: drag.x + 12, top: drag.y + 10 }}
        >
          {basename(drag.path)}
          {drag.over !== null && (
            <span className="ml-1 text-muted">
              → {drag.over === "" ? "корень базы" : basename(drag.over)}
            </span>
          )}
        </div>
      )}

      {menu && <RowMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

function RowMenu({
  path,
  isDir,
  x,
  y,
  onClose,
}: {
  path: string;
  isDir: boolean;
  x: number;
  y: number;
  onClose(): void;
}) {
  const vault = useVaultStore();
  const editor = useEditorStore();
  const dialogs = useDialogStore();
  const confirmDelete = useSettingsStore((state) => state.vault.confirmDelete);
  const isRoot = path === "";
  const folder = isDir ? path : dirname(path);

  const act = async (action: string) => {
    onClose();
    if (action === "open" && !isDir) await editor.openNote(path);
    if (action === "open-split" && !isDir) await editor.openNote(path, { inSplit: true });
    if (action === "pin") vault.togglePin(path);
    if (action === "rename") {
      const name = await dialogs.prompt({
        title: "Новое имя",
        value: isDir ? basename(path) : basename(path).replace(/\.md$/i, ""),
      });
      if (!name) return;
      const target = await vault.renameEntry(path, name);
      if (target) editor.renamed(path, target);
    }
    if (action === "remove") {
      if (confirmDelete) {
        const confirmed = await dialogs.confirm({
          title: isDir ? "Удалить папку?" : "Удалить заметку?",
          message: path,
          danger: true,
        });
        if (!confirmed) return;
      }
      await vault.removeEntry(path);
      editor.removed(path);
    }
    if (action === "new-note") {
      const created = await vault.createNote(folder, "Без названия");
      if (created) await editor.openNote(created);
    }
    if (action === "new-canvas") {
      const created = await vault.createCanvas(folder);
      if (created) await editor.openNote(created);
    }
    if (action === "new-folder") {
      const name = await dialogs.prompt({ title: "Имя папки", value: "", placeholder: "Проекты" });
      if (name) await vault.createFolder(folder, name);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} onTouchStart={onClose} />
      <div
        className="fixed z-50 w-52 overflow-hidden rounded-xl border bg-panel py-1 text-sm hairline panel-shadow"
        style={{
          left: Math.max(8, Math.min(x, window.innerWidth - 220)),
          top: Math.min(y, window.innerHeight - 280),
        }}
      >
        {!isDir && !isRoot && (
          <>
            <MenuItem onClick={() => void act("open")}>
              <FileText size={14} /> Открыть
            </MenuItem>
            <MenuItem onClick={() => void act("open-split")}>
              <FileText size={14} /> Открыть во второй панели
            </MenuItem>
            <MenuItem onClick={() => void act("pin")}>
              {vault.isPinned(path) ? <PinOff size={14} /> : <Pin size={14} />}
              {vault.isPinned(path) ? "Открепить" : "Закрепить"}
            </MenuItem>
          </>
        )}
        <MenuItem onClick={() => void act("new-note")}>
          <FilePlus2 size={14} /> Новая заметка{isRoot ? " в корне" : ""}
        </MenuItem>
        <MenuItem onClick={() => void act("new-canvas")}>
          <SquareDashedMousePointer size={14} /> Новый холст
        </MenuItem>
        <MenuItem onClick={() => void act("new-folder")}>
          <FolderPlus size={14} /> Новая папка{isRoot ? " в корне" : ""}
        </MenuItem>
        {!isRoot && (
          <>
            <MenuItem onClick={() => void act("rename")}>Переименовать</MenuItem>
            <MenuItem danger onClick={() => void act("remove")}>
              Удалить
            </MenuItem>
          </>
        )}
      </div>
    </>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick(): void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full touch-row items-center gap-2 px-3 text-left hover:bg-hover ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}
