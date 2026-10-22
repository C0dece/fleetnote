import { CornerDownRight, ListTree, Share2 } from "lucide-react";
import { useUIStore, type RightTab } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useEditorStore } from "@/stores/editorStore";
import { TitleBar } from "./TitleBar";
import { LayoutView } from "./LayoutView";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { ResizeHandle } from "./ResizeHandle";
import { BacklinksPanel } from "@/components/backlinks/BacklinksPanel";
import { Outline } from "@/components/backlinks/Outline";
import { LocalGraph } from "@/components/backlinks/LocalGraph";

/** Трёхколоночная раскладка ПК: дерево | редактор (+ split) | инспектор. */
export function DesktopShell() {
  const ui = useUIStore();
  const active = useEditorStore((state) => state.active);
  const appearance = useSettingsStore((state) => state.appearance);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        {ui.leftOpen && (
          <>
            <aside style={{ width: ui.leftWidth }} className="flex min-h-0 shrink-0 flex-col bg-panel">
              <Sidebar />
            </aside>
            <ResizeHandle side="left" width={ui.leftWidth} onResize={ui.setLeftWidth} />
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <LayoutView />
        </main>

        {ui.rightOpen && (
          <>
            <ResizeHandle side="right" width={ui.rightWidth} onResize={ui.setRightWidth} />
            <aside style={{ width: ui.rightWidth }} className="flex min-h-0 shrink-0 flex-col bg-panel">
              <div className="flex items-center gap-1 px-2 py-2">
                <RightSegment tab="backlinks" icon={<CornerDownRight size={14} />} label="Ссылки" />
                <RightSegment tab="outline" icon={<ListTree size={14} />} label="Оглавление" />
                <RightSegment tab="graph" icon={<Share2 size={14} />} label="Граф" />
              </div>
              {ui.rightTab === "backlinks" && <BacklinksPanel path={active} />}
              {ui.rightTab === "outline" && <Outline path={active} />}
              {ui.rightTab === "graph" && <LocalGraph path={active} />}
            </aside>
          </>
        )}
      </div>
      {appearance.showStatusBar && <StatusBar />}
    </div>
  );
}

function RightSegment({ tab, icon, label }: { tab: RightTab; icon: React.ReactNode; label: string }) {
  const current = useUIStore((state) => state.rightTab);
  const setRightTab = useUIStore((state) => state.setRightTab);
  return (
    <button
      type="button"
      onClick={() => setRightTab(tab)}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] ${
        current === tab ? "bg-accent-soft text-ink" : "text-muted hover:bg-hover"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
