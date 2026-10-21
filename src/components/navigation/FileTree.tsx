import { useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
} from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useDialogStore } from "@/components/ui/dialogs";
import { useUIStore } from "@/stores/uiStore";
import { basename, dirname } from "@/core/fs/paths";

interface Row {
  path: string;
  name: string;
  isDir: boolean;
  depth: number;
  expanded?: boolean;
  tasks?: { total: number; done: number };
}

const ROW_HEIGHT = 32;
const TOUCH_ROW_HEIGHT = 44;
const OVERSCAN = 8;

/**
 * Дерево базы с виртуализацией: рендерятся только видимые строки.
 * На 2 000+ заметок это разница между 60 FPS и фризом при разворачивании папки.
 */
export function FileTree({ touch = false }: { touch?: boolean }) {
  const notes = useVaultStore((state) => state.notes);
  const revision = useVaultStore((state) => state.revision);
  const manager = useVaultStore((state) => state.manager);
  const openNote = useEditorStore((state) => state.openNote);
  const active = useEditorStore((state) => state.active);
  const setSheet = useUIStore((state) => state.setSheet);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(480);
  const [menu, setMenu] = useState<{ path: string; isDir: boolean; x: number; y: number } | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const rowHeight = touch ? TOUCH_ROW_HEIGHT : ROW_HEIGHT;

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
    for (const note of notes) {
      push(dirname(note.path), {
        path: note.path,
        name: note.title || basename(note.path),
        isDir: false,
        depth: 0,
        tasks: note.tasks,
      });
    }
    for (const list of children.values()) {
      list.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name, "ru"));
    }
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
  }, [notes, manager, collapsed, revision]);

  const measure = useCallback((node: HTMLDivElement | null) => {
    viewport.current = node;
    if (node) setHeight(node.clientHeight || 480);
  }, []);

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const visibleCount = Math.ceil(height / rowHeight) + OVERSCAN * 2;
  const slice = rows.slice(first, first + visibleCount);

  const toggle = (path: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={measure}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-y-auto px-1"
      >
        <div style={{ height: rows.length * rowHeight, position: "relative" }}>
          {slice.map((row, index) => {
            const top = (first + index) * rowHeight;
            const isActive = row.path === active;
            return (
              <div
                key={row.path}
                style={{ position: "absolute", top, height: rowHeight, left: 0, right: 0 }}
                className="flex items-center"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (row.isDir) {
                      toggle(row.path);
                      return;
                    }
                    void openNote(row.path);
                    // на телефоне шторка должна уйти, иначе заметка остаётся за ней
                    setSheet("none");
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ path: row.path, isDir: row.isDir, x: event.clientX, y: event.clientY });
                  }}
                  className={`flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-lg pr-1 text-left text-[13.5px] transition-colors hover:bg-hover ${
                    isActive ? "bg-accent-soft text-ink" : "text-muted"
                  }`}
                  style={{ paddingLeft: 6 + row.depth * 14 }}
                >
                  {row.isDir ? (
                    <>
                      {row.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {row.expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                    </>
                  ) : (
                    <FileText size={15} className="ml-3.5 shrink-0 opacity-70" />
                  )}
                  <span className={`truncate ${isActive ? "text-ink" : ""}`}>{row.name}</span>
                  {row.tasks && row.tasks.total > 0 && (
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted">
                      {row.tasks.done}/{row.tasks.total}
                    </span>
                  )}
                </button>
                {/* Кнопка «…» дублирует правый клик: на телефоне иначе до действий не добраться */}
                <button
                  type="button"
                  aria-label="Действия"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({ path: row.path, isDir: row.isDir, x: rect.left - 150, y: rect.bottom + 4 });
                  }}
                  className={`mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover ${
                    touch ? "" : "opacity-0 focus:opacity-100 group-hover:opacity-100 hover:opacity-100"
                  }`}
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
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

  const act = async (action: "open" | "rename" | "remove" | "new-note" | "new-folder") => {
    onClose();
    if (action === "open" && !isDir) await editor.openNote(path);
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
      const confirmed = await dialogs.confirm({
        title: isDir ? "Удалить папку?" : "Удалить заметку?",
        message: path,
        danger: true,
      });
      if (!confirmed) return;
      await vault.removeEntry(path);
      editor.removed(path);
    }
    if (action === "new-note") {
      const created = await vault.createNote(isDir ? path : dirname(path), "Без названия");
      if (created) await editor.openNote(created);
    }
    if (action === "new-folder") {
      const name = await dialogs.prompt({ title: "Имя папки", value: "" });
      if (name) await vault.createFolder(isDir ? path : dirname(path), name);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} onTouchStart={onClose} />
      <div
        className="fixed z-50 w-44 overflow-hidden rounded-xl border bg-panel py-1 text-sm hairline panel-shadow"
        style={{
          left: Math.max(8, Math.min(x, window.innerWidth - 184)),
          top: Math.min(y, window.innerHeight - 220),
        }}
      >
        {!isDir && (
          <MenuItem onClick={() => void act("open")}>
            <FileText size={14} /> Открыть
          </MenuItem>
        )}
        <MenuItem onClick={() => void act("new-note")}>
          <FilePlus2 size={14} /> Новая заметка
        </MenuItem>
        <MenuItem onClick={() => void act("new-folder")}>
          <FolderPlus size={14} /> Новая папка
        </MenuItem>
        <MenuItem onClick={() => void act("rename")}>Переименовать</MenuItem>
        <MenuItem danger onClick={() => void act("remove")}>
          Удалить
        </MenuItem>
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
