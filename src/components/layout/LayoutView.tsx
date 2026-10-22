import { useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import type { LayoutNode } from "@/core/layout";
import { PaneView } from "./PaneView";
import { TabDragGhost } from "./TabBar";

/** Рекурсивный рендер дерева раскладки: панели и перетаскиваемые разделители. */
export function LayoutView() {
  const root = useEditorStore((state) => state.root);
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <Node node={root} />
      <TabDragGhost />
    </div>
  );
}

function Node({ node }: { node: LayoutNode }) {
  if (node.type === "pane") return <PaneView paneId={node.id} />;
  return <Split node={node} />;
}

function Split({ node }: { node: Extract<LayoutNode, { type: "split" }> }) {
  const setSizes = useEditorStore((state) => state.setSizes);
  const container = useRef<HTMLDivElement | null>(null);

  const startResize = useCallback(
    (index: number) => (event: React.PointerEvent) => {
      event.preventDefault();
      const box = container.current?.getBoundingClientRect();
      if (!box) return;
      const horizontal = node.dir === "row";
      const total = horizontal ? box.width : box.height;
      const startPos = horizontal ? event.clientX : event.clientY;
      const startSizes = [...node.sizes];

      const move = (moveEvent: PointerEvent) => {
        const delta = ((horizontal ? moveEvent.clientX : moveEvent.clientY) - startPos) / total;
        const next = [...startSizes];
        const min = 0.12;
        const left = startSizes[index] + delta;
        const right = startSizes[index + 1] - delta;
        if (left < min || right < min) return;
        next[index] = left;
        next[index + 1] = right;
        setSizes(node.id, next);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.cursor = "";
      };
      document.body.style.cursor = horizontal ? "col-resize" : "row-resize";
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [node, setSizes],
  );

  return (
    <div
      ref={container}
      className={`flex min-h-0 min-w-0 flex-1 ${node.dir === "row" ? "flex-row" : "flex-col"}`}
    >
      {node.children.map((child, index) => (
        <div
          key={child.id}
          className="flex min-h-0 min-w-0"
          style={{ flexGrow: node.sizes[index] ?? 1, flexBasis: 0 }}
        >
          <Node node={child} />
          {index < node.children.length - 1 && (
            <div
              role="separator"
              onPointerDown={startResize(index)}
              className={`shrink-0 bg-[var(--fn-hairline)] hover:bg-accent ${
                node.dir === "row" ? "w-px cursor-col-resize" : "h-px cursor-row-resize"
              }`}
              style={node.dir === "row" ? { marginRight: -0.5 } : { marginBottom: -0.5 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
