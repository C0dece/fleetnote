import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Columns2,
  Minus,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
  Square,
  X,
} from "lucide-react";
import { isTauri } from "@/core/fs";
import { useUIStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import { IconButton } from "@/components/ui/IconButton";
import { SyncBadge } from "./SyncBadge";

/** Тонкий заголовок окна: навигация, панели и системные кнопки в 36px. */
export function TitleBar() {
  const ui = useUIStore();
  const editor = useEditorStore();
  const rootLabel = useVaultStore((state) => state.rootLabel);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      setMaximized(await getCurrentWindow().isMaximized());
    })();
  }, []);

  const windowAction = async (action: "minimize" | "toggle" | "close") => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const current = getCurrentWindow();
    if (action === "minimize") await current.minimize();
    if (action === "close") await current.close();
    if (action === "toggle") {
      await current.toggleMaximize();
      setMaximized(await current.isMaximized());
    }
  };

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
        <IconButton
          title="Разделить экран"
          onClick={() => editor.setSplit(editor.split ? null : editor.active)}
          active={Boolean(editor.split)}
        >
          <Columns2 size={15} />
        </IconButton>
        <IconButton title="Правая панель" onClick={() => ui.toggleRight()} active={ui.rightOpen}>
          <PanelRight size={15} />
        </IconButton>
        <IconButton title="Настройки" onClick={() => ui.setSettings(true)}>
          <Settings size={15} />
        </IconButton>
        {isTauri() && (
          <div className="ml-1 flex items-center gap-0.5">
            <IconButton title="Свернуть" onClick={() => void windowAction("minimize")}>
              <Minus size={14} />
            </IconButton>
            <IconButton
              title={maximized ? "Восстановить" : "Развернуть"}
              onClick={() => void windowAction("toggle")}
            >
              <Square size={12} />
            </IconButton>
            <IconButton
              title="Закрыть"
              onClick={() => void windowAction("close")}
              className="hover:bg-danger hover:text-white"
            >
              <X size={15} />
            </IconButton>
          </div>
        )}
      </div>
    </header>
  );
}
