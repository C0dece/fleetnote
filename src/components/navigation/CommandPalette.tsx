import { useMemo, useState } from "react";
import { Command } from "cmdk";
import {
  FilePlus2,
  FileText,
  FolderOpen,
  Moon,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Settings,
  SunMedium,
} from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useSyncStore } from "@/stores/syncStore";
import { useUIStore } from "@/stores/uiStore";

export interface PaletteCommand {
  id: string;
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  run(): void | Promise<void>;
}

/**
 * Палитра команд (`Ctrl/Cmd+K`) и быстрое открытие заметки (`Ctrl/Cmd+O`) —
 * одно окно в двух режимах. На мобильных открывается полноэкранно,
 * поле ввода вверху, чтобы не перекрывалось клавиатурой.
 */
export function CommandPalette({ mode }: { mode: "commands" | "notes" }) {
  const [query, setQuery] = useState("");
  const vault = useVaultStore();
  const editor = useEditorStore();
  const ui = useUIStore();
  const sync = useSyncStore();

  const open = mode === "commands" ? ui.palette : ui.quickSwitch;
  const close = () => {
    setQuery("");
    if (mode === "commands") ui.setPalette(false);
    else ui.setQuickSwitch(false);
  };

  const notes = useMemo(() => vault.suggest(query).slice(0, mode === "notes" ? 30 : 6), [query, vault, mode]);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "new-note",
        title: "Новая заметка",
        hint: "Ctrl/Cmd + N",
        icon: <FilePlus2 size={15} />,
        run: async () => {
          const path = await vault.createNote(
            editor.active ? editor.active.split("/").slice(0, -1).join("/") : "",
          );
          if (path) await editor.openNote(path);
        },
      },
      {
        id: "open-vault",
        title: "Открыть другую папку с заметками",
        icon: <FolderOpen size={15} />,
        run: () => void vault.pickFolder(),
      },
      {
        id: "sync",
        title: "Синхронизировать сейчас",
        icon: <RefreshCw size={15} />,
        run: () => void sync.syncNow(),
      },
      {
        id: "theme",
        title: `Тема: ${ui.theme === "light" ? "светлая" : ui.theme === "dark" ? "тёмная" : "AMOLED"} → следующая`,
        icon: ui.theme === "light" ? <SunMedium size={15} /> : <Moon size={15} />,
        run: () => ui.setTheme(ui.theme === "light" ? "dark" : ui.theme === "dark" ? "amoled" : "light"),
      },
      {
        id: "left",
        title: "Показать/скрыть левую панель",
        hint: "Ctrl/Cmd + \\",
        icon: <PanelLeft size={15} />,
        run: () => ui.toggleLeft(),
      },
      {
        id: "right",
        title: "Показать/скрыть правую панель",
        icon: <PanelRight size={15} />,
        run: () => ui.toggleRight(),
      },
      {
        id: "settings",
        title: "Настройки",
        icon: <Settings size={15} />,
        run: () => ui.setSettings(true),
      },
      {
        id: "rescan",
        title: "Перечитать базу с диска",
        icon: <RefreshCw size={15} />,
        run: () => void vault.rescan(),
      },
    ],
    [vault, editor, ui, sync],
  );

  const filteredCommands = useMemo(() => {
    if (mode === "notes") return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => command.title.toLowerCase().includes(needle));
  }, [commands, query, mode]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      shouldFilter={false}
      label={mode === "commands" ? "Палитра команд" : "Открыть заметку"}
      overlayClassName="fixed inset-0 z-40 bg-black/50"
      contentClassName="fixed left-1/2 top-0 z-50 w-full -translate-x-1/2 sm:top-[12vh] sm:max-w-xl sm:px-4"
      className="flex max-h-screen w-full flex-col overflow-hidden border bg-panel hairline panel-shadow sm:max-h-[70vh] sm:rounded-2xl"
    >
      <div className="pt-safe" />
      <Command.Input
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder={mode === "commands" ? "Команда или заметка…" : "Название заметки…"}
        className="w-full border-b bg-transparent px-4 py-3.5 text-[16px] text-ink outline-none hairline placeholder:text-muted"
      />
      <Command.List className="min-h-0 flex-1 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">Ничего не найдено</Command.Empty>

        {filteredCommands.length > 0 && (
          <Command.Group heading="Команды" className="px-1 text-[11px] uppercase tracking-wide text-muted">
            {filteredCommands.map((command) => (
              <Command.Item
                key={command.id}
                value={command.id}
                onSelect={() => {
                  close();
                  void command.run();
                }}
                className="flex touch-row cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-ink data-[selected=true]:bg-accent-soft"
              >
                <span className="text-muted">{command.icon}</span>
                <span className="flex-1 truncate normal-case">{command.title}</span>
                {command.hint && <kbd className="text-[11px] text-muted">{command.hint}</kbd>}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {notes.length > 0 && (
          <Command.Group
            heading="Заметки"
            className="mt-1 px-1 text-[11px] uppercase tracking-wide text-muted"
          >
            {notes.map((note) => (
              <Command.Item
                key={note.path}
                value={note.path}
                onSelect={() => {
                  close();
                  void editor.openNote(note.path);
                }}
                className="flex touch-row cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-ink data-[selected=true]:bg-accent-soft"
              >
                <FileText size={15} className="text-muted" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate normal-case">{note.title}</span>
                  <span className="truncate text-[11.5px] normal-case text-muted">{note.path}</span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
