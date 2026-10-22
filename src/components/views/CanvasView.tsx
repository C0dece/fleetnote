import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Link2, Plus, Save, Square, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { stem } from "@/core/fs/paths";

/** Формат холста совместим с Obsidian Canvas: те же поля, тот же `.canvas`. */
interface CanvasNode {
  id: string;
  type: "text" | "file";
  text?: string;
  file?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: string;
  toSide?: string;
  label?: string;
  color?: string;
}

interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const COLORS = ["", "#EF4444", "#F59E0B", "#10B981", "#6366F1", "#EC4899"];
const SAVE_DEBOUNCE = 700;

/** Холст: бесконечное полотно с карточками заметок и текста и связями между ними. */
export function CanvasView({ path }: { path: string }) {
  const vault = useVaultStore();
  const openNote = useEditorStore((state) => state.openNote);
  const notes = useVaultStore((state) => state.notes);

  const [data, setData] = useState<CanvasData>({ nodes: [], edges: [] });
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [linking, setLinking] = useState<{ from: string; x: number; y: number } | null>(null);
  const [picker, setPicker] = useState(false);
  const surface = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    void (async () => {
      try {
        const raw = await vault.readRaw(path);
        const parsed = JSON.parse(raw || "{}") as Partial<CanvasData>;
        setData({ nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] });
      } catch {
        setData({ nodes: [], edges: [] });
      }
      loaded.current = true;
    })();
  }, [path, vault]);

  // Автосохранение: холст пишется тем же файлом, что читает Obsidian
  useEffect(() => {
    if (!loaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void vault.writeRaw(path, JSON.stringify(data, null, 2));
    }, SAVE_DEBOUNCE);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, path, vault]);

  const update = useCallback((patch: (current: CanvasData) => CanvasData) => setData(patch), []);

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = surface.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - view.x) / view.scale,
        y: (clientY - rect.top - view.y) / view.scale,
      };
    },
    [view],
  );

  const addNode = (node: Partial<CanvasNode>) => {
    const rect = surface.current?.getBoundingClientRect();
    const center = toWorld(
      (rect?.left ?? 0) + (rect?.width ?? 600) / 2,
      (rect?.top ?? 0) + (rect?.height ?? 400) / 2,
    );
    const id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    update((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        {
          id,
          type: "text",
          text: "",
          x: Math.round(center.x - 110),
          y: Math.round(center.y - 60),
          width: 220,
          height: 120,
          ...node,
        } as CanvasNode,
      ],
    }));
    setSelected(id);
  };

  const removeNode = (id: string) =>
    update((current) => ({
      nodes: current.nodes.filter((node) => node.id !== id),
      edges: current.edges.filter((edge) => edge.fromNode !== id && edge.toNode !== id),
    }));

  const dragNode = (id: string) => (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelected(id);
    const node = data.nodes.find((item) => item.id === id);
    if (!node) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { x: node.x, y: node.y };
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / view.scale;
      const dy = (moveEvent.clientY - startY) / view.scale;
      update((current) => ({
        ...current,
        nodes: current.nodes.map((item) =>
          item.id === id ? { ...item, x: Math.round(origin.x + dx), y: Math.round(origin.y + dy) } : item,
        ),
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const resizeNode = (id: string) => (event: React.PointerEvent) => {
    event.stopPropagation();
    const node = data.nodes.find((item) => item.id === id);
    if (!node) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { width: node.width, height: node.height };
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / view.scale;
      const dy = (moveEvent.clientY - startY) / view.scale;
      update((current) => ({
        ...current,
        nodes: current.nodes.map((item) =>
          item.id === id
            ? {
                ...item,
                width: Math.max(120, Math.round(origin.width + dx)),
                height: Math.max(80, Math.round(origin.height + dy)),
              }
            : item,
        ),
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startLink = (id: string) => (event: React.PointerEvent) => {
    event.stopPropagation();
    const point = toWorld(event.clientX, event.clientY);
    setLinking({ from: id, x: point.x, y: point.y });
    const move = (moveEvent: PointerEvent) => {
      const next = toWorld(moveEvent.clientX, moveEvent.clientY);
      setLinking((current) => (current ? { ...current, x: next.x, y: next.y } : null));
    };
    const up = (upEvent: PointerEvent) => {
      const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
      const target = element?.closest<HTMLElement>("[data-canvas-node]")?.dataset.canvasNode;
      if (target && target !== id) {
        update((current) => ({
          ...current,
          edges: [
            ...current.edges,
            {
              id: `e${Date.now().toString(36)}`,
              fromNode: id,
              toNode: target,
              fromSide: "right",
              toSide: "left",
            },
          ],
        }));
      }
      setLinking(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const panSurface = (event: React.PointerEvent) => {
    if (event.target !== event.currentTarget) return;
    setSelected(null);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...view };
    const move = (moveEvent: PointerEvent) => {
      setView({
        ...origin,
        x: origin.x + (moveEvent.clientX - startX),
        y: origin.y + (moveEvent.clientY - startY),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const edgeLines = useMemo(() => {
    const byId = new Map(data.nodes.map((node) => [node.id, node]));
    return data.edges.flatMap((edge) => {
      const from = byId.get(edge.fromNode);
      const to = byId.get(edge.toNode);
      if (!from || !to) return [];
      return [
        {
          id: edge.id,
          x1: from.x + from.width,
          y1: from.y + from.height / 2,
          x2: to.x,
          y2: to.y + to.height / 2,
          color: edge.color,
        },
      ];
    });
  }, [data]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-2 py-1.5 hairline">
        <button
          type="button"
          onClick={() => addNode({ type: "text", text: "Новая карточка" })}
          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[12.5px] text-ink hairline hover:bg-hover"
        >
          <Plus size={13} /> Карточка
        </button>
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[12.5px] text-ink hairline hover:bg-hover"
        >
          <FileText size={13} /> Заметка
        </button>
        {selected && (
          <>
            <div className="flex items-center gap-1 rounded-lg border px-1.5 py-1 hairline">
              {COLORS.map((color) => (
                <button
                  key={color || "none"}
                  type="button"
                  aria-label={color || "без цвета"}
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      nodes: current.nodes.map((node) =>
                        node.id === selected ? { ...node, color: color || undefined } : node,
                      ),
                    }))
                  }
                  style={{ background: color || "transparent" }}
                  className={`size-4 rounded-full border hairline ${color ? "" : "bg-panel-2"}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                removeNode(selected);
                setSelected(null);
              }}
              className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[12.5px] text-danger hairline hover:bg-hover"
            >
              <Trash2 size={13} /> Удалить
            </button>
          </>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Уменьшить"
            onClick={() => setView((current) => ({ ...current, scale: Math.max(0.3, current.scale - 0.1) }))}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-hover"
          >
            <ZoomOut size={14} />
          </button>
          <span className="w-10 text-center text-[12px] tabular-nums text-muted">
            {Math.round(view.scale * 100)}%
          </span>
          <button
            type="button"
            aria-label="Увеличить"
            onClick={() => setView((current) => ({ ...current, scale: Math.min(2.5, current.scale + 0.1) }))}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-hover"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            title="Сохранить сейчас"
            aria-label="Сохранить"
            onClick={() => void vault.writeRaw(path, JSON.stringify(data, null, 2))}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-hover"
          >
            <Save size={14} />
          </button>
        </span>
      </div>

      <div
        ref={surface}
        onPointerDown={panSurface}
        onDoubleClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const point = toWorld(event.clientX, event.clientY);
          addNode({ type: "text", text: "", x: Math.round(point.x), y: Math.round(point.y) });
        }}
        onWheel={(event) => {
          const delta = event.deltaY > 0 ? 0.92 : 1.08;
          setView((current) => ({ ...current, scale: Math.min(2.5, Math.max(0.3, current.scale * delta)) }));
        }}
        className="relative min-h-0 flex-1 overflow-hidden bg-canvas"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, var(--fn-hairline) 1px, transparent 0)",
          backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <svg className="pointer-events-none absolute overflow-visible" width={1} height={1}>
            {edgeLines.map((line) => (
              <g key={line.id}>
                <path
                  d={`M ${line.x1} ${line.y1} C ${line.x1 + 60} ${line.y1}, ${line.x2 - 60} ${line.y2}, ${line.x2} ${line.y2}`}
                  stroke={line.color ?? "var(--fn-ink-muted)"}
                  strokeWidth={2}
                  fill="none"
                />
                <circle cx={line.x2} cy={line.y2} r={3} fill={line.color ?? "var(--fn-ink-muted)"} />
              </g>
            ))}
            {linking && (
              <path
                d={`M ${linking.x} ${linking.y} L ${linking.x} ${linking.y}`}
                stroke="var(--fn-accent)"
                strokeWidth={2}
                fill="none"
              />
            )}
          </svg>

          {data.nodes.map((node) => (
            <div
              key={node.id}
              data-canvas-node={node.id}
              onPointerDown={dragNode(node.id)}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                borderColor: node.color ?? "var(--fn-hairline)",
              }}
              className={`absolute flex flex-col overflow-hidden rounded-xl border-2 bg-panel ${
                selected === node.id ? "ring-2 ring-[var(--fn-accent)]" : ""
              }`}
            >
              {node.type === "file" ? (
                <button
                  type="button"
                  onDoubleClick={() => node.file && void openNote(node.file)}
                  className="flex h-full w-full flex-col items-start gap-1 p-2 text-left"
                >
                  <span className="flex items-center gap-1 text-[12px] text-accent">
                    <FileText size={12} /> {stem(node.file ?? "")}
                  </span>
                  <span className="line-clamp-4 text-[12px] text-muted">
                    {notes.find((item) => item.path === node.file)?.excerpt ?? "Двойной клик — открыть"}
                  </span>
                </button>
              ) : (
                <textarea
                  value={node.text ?? ""}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    update((current) => ({
                      ...current,
                      nodes: current.nodes.map((item) =>
                        item.id === node.id ? { ...item, text: event.target.value } : item,
                      ),
                    }))
                  }
                  placeholder="Текст карточки"
                  className="h-full w-full resize-none bg-transparent p-2 text-[13px] text-ink outline-none placeholder:text-muted"
                />
              )}

              <button
                type="button"
                aria-label="Связать"
                title="Потяните к другой карточке"
                onPointerDown={startLink(node.id)}
                className="absolute -right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full border bg-panel text-muted hairline hover:text-accent"
              >
                <Link2 size={11} />
              </button>
              <button
                type="button"
                aria-label="Изменить размер"
                onPointerDown={resizeNode(node.id)}
                className="absolute bottom-0 right-0 flex size-4 cursor-nwse-resize items-center justify-center text-muted"
              >
                <Square size={9} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {picker && (
        <NotePicker
          onClose={() => setPicker(false)}
          onPick={(notePath) => {
            setPicker(false);
            addNode({ type: "file", file: notePath, text: undefined });
          }}
        />
      )}
    </div>
  );
}

function NotePicker({ onPick, onClose }: { onPick(path: string): void; onClose(): void }) {
  const notes = useVaultStore((state) => state.notes);
  const [query, setQuery] = useState("");
  const filtered = notes
    .filter((note) => !query || note.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[60vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-panel hairline panel-shadow"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Какую заметку положить на холст?"
          className="border-b bg-transparent px-4 py-3 text-[15px] text-ink outline-none hairline placeholder:text-muted"
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {filtered.map((note) => (
            <button
              key={note.path}
              type="button"
              onClick={() => onPick(note.path)}
              className="flex w-full touch-row flex-col items-start rounded-lg px-3 text-left hover:bg-hover"
            >
              <span className="truncate text-[14px] text-ink">{note.title}</span>
              <span className="truncate text-[11.5px] text-muted">{note.path}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
