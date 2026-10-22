import { useRef } from "react";
import { Drawer } from "vaul";
import {
  ArrowLeft,
  Cloud,
  Files,
  Layers,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useUIStore, type MobileSheet } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useSyncStore } from "@/stores/syncStore";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { Sidebar } from "./Sidebar";
import { EditorPane } from "./EditorPane";
import { SyncBadge } from "./SyncBadge";
import { MobileKeyboardToolbar } from "@/components/editor/MobileKeyboardToolbar";
import type { EditorHandle } from "@/components/editor/Editor";

/**
 * Мобильная оболочка. Логика и редактор те же, что на ПК, —
 * меняется только навигация: шторки, нижняя панель и надклавиатурный тулбар.
 */
export function MobileShell() {
  const editorHandle = useRef<EditorHandle | null>(null);
  const ui = useUIStore();
  const editor = useEditorStore();
  const vault = useVaultStore();
  const viewport = useVisualViewport();
  const active = editor.active;
  const title = active ? (vault.manager?.notes.get(active)?.title ?? active) : "Fleetnote";
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="flex shrink-0 flex-col border-b bg-panel hairline pt-safe">
        <div className="flex h-12 items-center gap-1 px-1">
          <button
            type="button"
            aria-label="Назад"
            onClick={() => editor.back()}
            className="flex size-11 items-center justify-center rounded-xl text-muted active:bg-hover"
          >
            <ArrowLeft size={18} className={editor.canBack() ? "" : "opacity-40"} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-[15px] font-medium text-ink">{title}</h1>
          <SyncBadge compact />
          <button
            type="button"
            aria-label="Ещё"
            onClick={() => ui.setSettings(true)}
            className="flex size-11 items-center justify-center rounded-xl text-muted active:bg-hover"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      <main
        className="min-h-0 flex-1"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          if (!start || !touch) return;
          const dx = touch.clientX - start.x;
          const dy = Math.abs(touch.clientY - start.y);
          // Свайп от левого края вправо — назад по истории ссылок, как в мобильном браузере.
          if (start.x < 28 && dx > 70 && dy < 50) editor.back();
          touchStart.current = null;
        }}
      >
        <EditorPane path={active} handle={editorHandle} />
      </main>

      <MobileKeyboardToolbar editor={editorHandle} />

      {!viewport.keyboardOpen && (
        <nav className="flex shrink-0 items-stretch border-t bg-panel hairline pb-safe">
          <NavButton icon={<Files size={19} />} label="Файлы" onClick={() => ui.setSheet("files")} />
          <NavButton icon={<Search size={19} />} label="Поиск" onClick={() => ui.setSheet("search")} />
          <NavButton
            icon={<Plus size={22} />}
            label="Новая"
            accent
            onClick={async () => {
              const path = await vault.createNote();
              if (path) await editor.openNote(path);
            }}
          />
          <NavButton
            icon={<Layers size={19} />}
            label="Вкладки"
            badge={editor.tabs.length}
            onClick={() => ui.setSheet("tabs")}
          />
          <NavButton icon={<Cloud size={19} />} label="Облако" onClick={() => ui.setSheet("sync")} />
        </nav>
      )}

      <Sheet sheet="files" title="Заметки">
        <Sidebar touch initialTab="files" />
      </Sheet>
      <Sheet sheet="search" title="Поиск">
        <Sidebar touch initialTab="search" />
      </Sheet>
      <Sheet sheet="tabs" title="Открытые заметки">
        <OpenTabs />
      </Sheet>
      <Sheet sheet="sync" title="Синхронизация">
        <SyncSheet />
      </Sheet>
    </div>
  );
}

function NavButton({
  icon,
  label,
  onClick,
  accent,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick(): void;
  accent?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] ${
        accent ? "text-accent" : "text-muted"
      } active:bg-hover`}
      style={{ minHeight: "var(--fn-touch)" }}
    >
      {icon}
      <span>{label}</span>
      {badge ? (
        <span className="absolute right-1/4 top-1 rounded-full bg-accent px-1 text-[9px] text-white tabular-nums">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** Нижняя шторка Vaul: тянется пальцем, закрывается свайпом вниз. */
function Sheet({ sheet, title, children }: { sheet: MobileSheet; title: string; children: React.ReactNode }) {
  const current = useUIStore((state) => state.sheet);
  const setSheet = useUIStore((state) => state.setSheet);
  return (
    <Drawer.Root open={current === sheet} onOpenChange={(open) => !open && setSheet("none")}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[82vh] flex-col rounded-t-2xl border bg-panel hairline panel-shadow">
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--fn-ink-muted)] opacity-40" />
          <Drawer.Title className="px-4 py-2 text-[13px] uppercase tracking-wide text-muted">
            {title}
          </Drawer.Title>
          <div className="flex min-h-0 flex-1 flex-col pb-safe">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function OpenTabs() {
  const tabs = useEditorStore((state) => state.tabs);
  const active = useEditorStore((state) => state.active);
  const setActive = useEditorStore((state) => state.setActive);
  const closeTab = useEditorStore((state) => state.closeTab);
  const setSheet = useUIStore((state) => state.setSheet);
  const notes = useVaultStore((state) => state.manager?.notes);

  if (!tabs.length) return <p className="px-4 py-6 text-center text-sm text-muted">Нет открытых заметок</p>;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2">
      {tabs.map((path) => (
        <div
          key={path}
          className={`flex touch-row items-center gap-2 rounded-xl px-2 ${path === active ? "bg-accent-soft" : ""}`}
        >
          <button
            type="button"
            onClick={() => {
              setActive(path);
              setSheet("none");
            }}
            className="flex min-w-0 flex-1 flex-col items-start py-2 text-left"
          >
            <span className="w-full truncate text-[15px] text-ink">{notes?.get(path)?.title ?? path}</span>
            <span className="w-full truncate text-[11.5px] text-muted">{path}</span>
          </button>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => void closeTab(path)}
            className="flex size-10 items-center justify-center rounded-lg text-muted active:bg-hover"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function SyncSheet() {
  const status = useSyncStore((state) => state.status);
  const profile = useSyncStore((state) => state.profile);
  const syncNow = useSyncStore((state) => state.syncNow);
  const busy = useSyncStore((state) => state.busy);
  const setSettings = useUIStore((state) => state.setSettings);
  const setSheet = useUIStore((state) => state.setSheet);

  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      <div className="rounded-xl border bg-canvas p-3 hairline">
        <p className="text-[13px] text-muted">Хранилище</p>
        <p className="text-[15px] text-ink">
          {status.adapterLabel ?? (profile?.adapter ? profile.adapter : "Не подключено")}
        </p>
        {status.message && <p className="mt-1 text-[12.5px] text-muted">{status.message}</p>}
        {status.pending > 0 && <p className="mt-1 text-[12.5px] text-warn">В очереди: {status.pending}</p>}
        {status.conflicts.length > 0 && (
          <p className="mt-1 text-[12.5px] text-warn">Конфликтные копии: {status.conflicts.length}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void syncNow()}
        disabled={busy || !profile?.adapter}
        className="flex touch-row items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-medium text-white disabled:opacity-50"
      >
        <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
        Синхронизировать сейчас
      </button>
      <button
        type="button"
        onClick={() => {
          setSheet("none");
          setSettings(true);
        }}
        className="flex touch-row items-center justify-center gap-2 rounded-xl border text-[15px] text-ink hairline"
      >
        <Settings size={16} />
        Настроить хранилище
      </button>
    </div>
  );
}
