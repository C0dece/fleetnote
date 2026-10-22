import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Focus, Maximize2, Minus, Plus } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";

interface GraphNode {
  path: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

const REPULSION = 2400;
const SPRING = 0.015;
const SPRING_LENGTH = 90;
const CENTER_PULL = 0.004;
const DAMPING = 0.86;

/**
 * Глобальный граф базы: силовая раскладка, нарисованная на canvas.
 * Своя реализация вместо библиотеки — меньше зависимостей и понятнее поведение.
 */
export function GraphView() {
  const notes = useVaultStore((state) => state.notes);
  const revision = useVaultStore((state) => state.revision);
  const manager = useVaultStore((state) => state.manager);
  const openNote = useEditorStore((state) => state.openNote);
  const active = useEditorStore((state) => state.active);

  const canvas = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<Map<string, GraphNode>>(new Map());
  const edgesRef = useRef<GraphEdge[]>([]);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const hoverRef = useRef<string | null>(null);
  const frame = useRef(0);

  const [query, setQuery] = useState("");
  const [showLabels, setShowLabels] = useState(true);
  const [onlyLinked, setOnlyLinked] = useState(false);

  const graph = useMemo(() => {
    void revision;
    const edges: GraphEdge[] = [];
    const degree = new Map<string, number>();
    for (const note of notes) {
      for (const link of manager?.linksFrom(note.path) ?? []) {
        if (!link.path) continue;
        edges.push({ from: note.path, to: link.path });
        degree.set(note.path, (degree.get(note.path) ?? 0) + 1);
        degree.set(link.path, (degree.get(link.path) ?? 0) + 1);
      }
    }
    const needle = query.trim().toLowerCase();
    const visible = notes.filter((note) => {
      if (onlyLinked && !(degree.get(note.path) ?? 0)) return false;
      if (!needle) return true;
      return note.title.toLowerCase().includes(needle) || note.path.toLowerCase().includes(needle);
    });
    const allowed = new Set(visible.map((note) => note.path));
    return {
      nodes: visible.map((note) => ({
        path: note.path,
        title: note.title,
        degree: degree.get(note.path) ?? 0,
      })),
      edges: edges.filter((edge) => allowed.has(edge.from) && allowed.has(edge.to)),
    };
  }, [notes, manager, revision, query, onlyLinked]);

  // Пересобираем модель, сохраняя позиции уже знакомых узлов
  useEffect(() => {
    const next = new Map<string, GraphNode>();
    const radius = 200 + graph.nodes.length * 2;
    graph.nodes.forEach((node, index) => {
      const existing = nodesRef.current.get(node.path);
      const angle = (index / Math.max(1, graph.nodes.length)) * Math.PI * 2;
      next.set(node.path, {
        ...node,
        x: existing?.x ?? Math.cos(angle) * radius,
        y: existing?.y ?? Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      });
    });
    nodesRef.current = next;
    edgesRef.current = graph.edges;
  }, [graph]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = element.getBoundingClientRect();
      element.width = Math.max(1, rect.width * ratio);
      element.height = Math.max(1, rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--fn-accent").trim() || "#6366F1";
    const ink = styles.getPropertyValue("--fn-ink").trim() || "#E6E8EC";
    const muted = styles.getPropertyValue("--fn-ink-muted").trim() || "#9AA1AC";

    const step = () => {
      const nodes = [...nodesRef.current.values()];
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distanceSq = Math.max(60, dx * dx + dy * dy);
          const distance = Math.sqrt(distanceSq);
          const force = REPULSION / distanceSq;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
        a.vx -= a.x * CENTER_PULL;
        a.vy -= a.y * CENTER_PULL;
      }
      for (const edge of edgesRef.current) {
        const a = nodesRef.current.get(edge.from);
        const b = nodesRef.current.get(edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = (distance - SPRING_LENGTH) * SPRING;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      for (const node of nodes) {
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;
      }
    };

    const draw = () => {
      const rect = element.getBoundingClientRect();
      const { x: panX, y: panY, scale } = viewRef.current;
      context.clearRect(0, 0, rect.width, rect.height);
      context.save();
      context.translate(rect.width / 2 + panX, rect.height / 2 + panY);
      context.scale(scale, scale);

      context.strokeStyle = muted;
      context.globalAlpha = 0.25;
      context.lineWidth = 1;
      context.beginPath();
      for (const edge of edgesRef.current) {
        const a = nodesRef.current.get(edge.from);
        const b = nodesRef.current.get(edge.to);
        if (!a || !b) continue;
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
      }
      context.stroke();
      context.globalAlpha = 1;

      for (const node of nodesRef.current.values()) {
        const isActive = node.path === active;
        const isHover = node.path === hoverRef.current;
        const radius = 4 + Math.min(8, node.degree * 1.2);
        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fillStyle = isActive || isHover ? accent : muted;
        context.fill();
        if (showLabels && (scale > 0.55 || isActive || isHover)) {
          context.fillStyle = isActive || isHover ? ink : muted;
          context.font = "11px system-ui, sans-serif";
          context.textAlign = "center";
          context.fillText(truncate(node.title, 22), node.x, node.y + radius + 11);
        }
      }
      context.restore();
    };

    const loop = () => {
      step();
      draw();
      frame.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame.current);
      observer.disconnect();
    };
  }, [active, showLabels]);

  const toWorld = (event: { clientX: number; clientY: number }) => {
    const element = canvas.current;
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    const { x: panX, y: panY, scale } = viewRef.current;
    return {
      x: (event.clientX - rect.left - rect.width / 2 - panX) / scale,
      y: (event.clientY - rect.top - rect.height / 2 - panY) / scale,
    };
  };

  const nodeAt = (point: { x: number; y: number }): GraphNode | null => {
    for (const node of nodesRef.current.values()) {
      const radius = 8 + Math.min(10, node.degree * 1.2);
      if (Math.hypot(node.x - point.x, node.y - point.y) <= radius) return node;
    }
    return null;
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-1.5 hairline">
        <div className="flex items-center gap-1.5 rounded-lg border bg-canvas px-2 hairline">
          <Filter size={13} className="text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Фильтр по названию"
            className="w-44 bg-transparent py-1.5 text-[13px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyLinked((value) => !value)}
          className={`rounded-lg border px-2 py-1 text-[12.5px] hairline ${
            onlyLinked ? "bg-accent text-white" : "text-muted hover:bg-hover"
          }`}
        >
          Только связанные
        </button>
        <button
          type="button"
          onClick={() => setShowLabels((value) => !value)}
          className={`rounded-lg border px-2 py-1 text-[12.5px] hairline ${
            showLabels ? "bg-accent-soft text-ink" : "text-muted hover:bg-hover"
          }`}
        >
          Подписи
        </button>
        <span className="text-[12px] text-muted">
          {graph.nodes.length} заметок · {graph.edges.length} связей
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Уменьшить"
            onClick={() => (viewRef.current.scale = Math.max(0.2, viewRef.current.scale - 0.15))}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-hover"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            aria-label="Увеличить"
            onClick={() => (viewRef.current.scale = Math.min(3, viewRef.current.scale + 0.15))}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-hover"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            aria-label="В центр"
            title="Вернуть в центр"
            onClick={() => (viewRef.current = { x: 0, y: 0, scale: 1 })}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-hover"
          >
            <Focus size={14} />
          </button>
          <button
            type="button"
            aria-label="К активной заметке"
            title="Показать активную заметку"
            onClick={() => {
              const node = active ? nodesRef.current.get(active) : null;
              if (node) viewRef.current = { x: -node.x, y: -node.y, scale: 1.2 };
            }}
            className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-hover"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <canvas
        ref={canvas}
        className="min-h-0 flex-1 cursor-grab active:cursor-grabbing"
        onPointerDown={(event) => {
          const node = nodeAt(toWorld(event));
          if (node) {
            void openNote(node.path);
            return;
          }
          const startX = event.clientX;
          const startY = event.clientY;
          const origin = { ...viewRef.current };
          const move = (moveEvent: PointerEvent) => {
            viewRef.current = {
              ...viewRef.current,
              x: origin.x + (moveEvent.clientX - startX),
              y: origin.y + (moveEvent.clientY - startY),
            };
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
        onMouseMove={(event) => {
          hoverRef.current = nodeAt(toWorld(event))?.path ?? null;
        }}
        onWheel={(event) => {
          const delta = event.deltaY > 0 ? 0.9 : 1.1;
          viewRef.current.scale = Math.min(3, Math.max(0.2, viewRef.current.scale * delta));
        }}
      />
    </div>
  );
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
