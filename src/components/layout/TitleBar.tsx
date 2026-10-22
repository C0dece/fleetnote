import { ArrowLeft, ArrowRight, Columns2, PanelLeft, PanelRight, Search, Settings } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import { IconButton } from "@/components/ui/IconButton";
import { SyncBadge } from "./SyncBadge";
import { WindowButtons } from "./WindowChrome";

/** Тонкий заголовок окна: навигация, панели и системные кнопки в 36px. */
export function TitleBar() {
  const ui = useUIStore();
  const editor = useEditorStore();
  const rootLabel = useVaultStore((state) => state.rootLabel);

  return (
    <header
      data-tauri-drag-region
      className="drag-region flex h-9 shrink-0 items-center gap-1 border-b bg-panel px-2 hairline"
    >
      <div className="no-drag flex items-center gap-0.5">
        <IconButton
          title="Скрыть левую панель (Ctrl/Cmd + \)"
          onClick={() => ui.toggleLeft()}
          active={ui.leftOpen}
        >
          <PanelLeft size={15} />
        </IconButton>
        <IconButton title="Назад" onClick={() => editor.back()}>
          <ArrowLeft size={15} className={editor.canBack() ? "" : "opacity-40"} />
        </IconButton>
        <IconButton title="Вперёд" onClick={() => editor.forward()}>
          <ArrowRight size={15} className={editor.canForward() ? "" : "opacity-40"} />
        </IconButton>
      </div>

      <div className="pointer-events-none mx-2 flex min-w-0 flex-1 items-center justify-center gap-2">
        <span className="truncate text-[12px] text-muted">{rootLabel || "Fleetnote"}</span>
      </div>

      <div className="no-drag flex items-center gap-0.5">
        <SyncBadge compact />
        <IconButton title="Поиск заметки (Ctrl/Cmd + O)" onClick={() => ui.setQuickSwitch(true)}>
          <Search size={15} />
        </IconButton>
        <IconButton title="Разделить экран по вертикали" onClick={() => editor.splitActive("row")}>
          <Columns2 size={15} />
        </IconButton>
        <IconButton title="Правая панель" onClick={() => ui.toggleRight()} active={ui.rightOpen}>
          <PanelRight size={15} />
        </IconButton>
        <IconButton title="Настройки" onClick={() => ui.setSettings(true)}>
          <Settings size={15} />
        </IconButton>
        <WindowButtons />
      </div>
    </header>
  );
}
