import { useEditorStore } from "@/stores/editorStore";
import { useDragStore } from "@/stores/dragStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { TabBar } from "./TabBar";
import { EditorPane } from "./EditorPane";
import { GraphView } from "@/components/views/GraphView";
import { CanvasView } from "@/components/views/CanvasView";
import { isCanvasTab, isGraphTab } from "@/core/views";

const ZONE_STYLES: Record<string, string> = {
  center: "inset-0",
  left: "left-0 top-0 bottom-0 w-1/2",
  right: "right-0 top-0 bottom-0 w-1/2",
  top: "left-0 right-0 top-0 h-1/2",
  bottom: "left-0 right-0 bottom-0 h-1/2",
};

/** Одна панель: свои вкладки, свой редактор, своя подсветка зоны сброса. */
export function PaneView({ paneId }: { paneId: string }) {
  const pane = useEditorStore((state) => state.panes[paneId]);
  const activePane = useEditorStore((state) => state.activePane);
  const setActivePane = useEditorStore((state) => state.setActivePane);
  const showTabStrip = useSettingsStore((state) => state.appearance.showTabStrip);
  const target = useDragStore((state) => state.target);
  const dragging = useDragStore((state) => state.path);

  if (!pane) return null;
  const highlight = dragging && target?.paneId === paneId && target.zone !== "center" ? target.zone : null;

  return (
    <section
      data-fn-pane={paneId}
      onPointerDown={() => activePane !== paneId && setActivePane(paneId)}
      className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${activePane === paneId ? "" : "opacity-95"}`}
    >
      {showTabStrip && <TabBar paneId={paneId} />}
      <div className="flex min-h-0 flex-1 flex-col">
        {pane.active && isGraphTab(pane.active) ? (
          <GraphView />
        ) : pane.active && isCanvasTab(pane.active) ? (
          <CanvasView path={pane.active} />
        ) : (
          <EditorPane path={pane.active} paneId={paneId} />
        )}
      </div>
      {highlight && (
        <div
          className={`pointer-events-none absolute z-20 rounded-lg border-2 border-accent bg-accent-soft ${ZONE_STYLES[highlight]}`}
        />
      )}
    </section>
  );
}
