import { useMemo } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";

const SIZE = 260;
const RADIUS = 96;

/**
 * Локальный граф: центр — открытая заметка, вокруг — соседи на одну связь.
 * Раскладка по кругу вместо силовой: предсказуемо и не ест батарею на телефоне.
 */
export function LocalGraph({ path }: { path: string | null }) {
  const vault = useVaultStore();
  const revision = useVaultStore((state) => state.revision);
  const openNote = useEditorStore((state) => state.openNote);

  const graph = useMemo(() => {
    void revision;
    if (!path || !vault.manager) return null;
    const { nodes, edges } = vault.manager.localGraph(path, 1);
    const others = nodes.filter((node) => node !== path);
    const positions = new Map<string, { x: number; y: number }>();
    positions.set(path, { x: SIZE / 2, y: SIZE / 2 });
    others.forEach((node, index) => {
      const angle = (index / Math.max(1, others.length)) * Math.PI * 2 - Math.PI / 2;
      positions.set(node, {
        x: SIZE / 2 + Math.cos(angle) * RADIUS,
        y: SIZE / 2 + Math.sin(angle) * RADIUS,
      });
    });
    return { nodes, edges, positions };
  }, [path, vault, revision]);

  if (!graph) return <p className="px-3 py-3 text-[12.5px] text-muted">Откройте заметку</p>;
  if (graph.nodes.length <= 1)
    return <p className="px-3 py-3 text-[12.5px] text-muted">У заметки пока нет связей</p>;

  const title = (node: string) => vault.manager?.notes.get(node)?.title ?? node;

  return (
    <div className="px-2 py-2">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label="Локальный граф связей">
        {graph.edges.map(([from, to]) => {
          const a = graph.positions.get(from);
          const b = graph.positions.get(to);
          if (!a || !b) return null;
          return (
            <line
              key={`${from}->${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--fn-hairline)"
              strokeWidth={1.5}
            />
          );
        })}
        {graph.nodes.map((node) => {
          const position = graph.positions.get(node);
          if (!position) return null;
          const isCenter = node === path;
          return (
            <g key={node} onClick={() => void openNote(node)} style={{ cursor: "pointer" }}>
              <circle
                cx={position.x}
                cy={position.y}
                r={isCenter ? 9 : 6}
                fill={isCenter ? "var(--fn-accent)" : "var(--fn-panel-2)"}
                stroke={isCenter ? "var(--fn-accent)" : "var(--fn-ink-muted)"}
                strokeWidth={1.2}
              />
              <title>{title(node)}</title>
              {!isCenter && (
                <text
                  x={position.x}
                  y={position.y + 18}
                  textAnchor="middle"
                  fill="var(--fn-ink-muted)"
                  fontSize="9"
                >
                  {truncate(title(node), 16)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
