import { create } from "zustand";
import type { DropZone } from "@/core/layout";

export interface TabDragTarget {
  paneId: string;
  zone: DropZone;
  /** Куда вставить вкладку в строке вкладок (только для zone === "center"). */
  index?: number;
}

interface DragState {
  path: string | null;
  fromPane: string | null;
  x: number;
  y: number;
  target: TabDragTarget | null;
  start(path: string, fromPane: string, x: number, y: number): void;
  move(x: number, y: number, target: TabDragTarget | null): void;
  end(): void;
}

/** Состояние перетаскивания вкладки. Отдельный стор, чтобы не дёргать редактор на каждый пиксель. */
export const useDragStore = create<DragState>((set) => ({
  path: null,
  fromPane: null,
  x: 0,
  y: 0,
  target: null,
  start: (path, fromPane, x, y) => set({ path, fromPane, x, y, target: null }),
  move: (x, y, target) => set({ x, y, target }),
  end: () => set({ path: null, fromPane: null, target: null }),
}));
