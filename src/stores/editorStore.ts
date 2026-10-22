import { create } from "zustand";
import { useVaultStore } from "./vaultStore";
import { settings } from "./settingsStore";
import type { EditorMode } from "./settingsStore";
import { isSpecialTab } from "@/core/views";
import {
  insertBeside,
  makeId,
  normalize,
  paneIds,
  replaceNode,
  type DropZone,
  type LayoutNode,
  type Pane,
  type SplitDirection,
} from "@/core/layout";

interface EditorStoreState {
  /** Дерево раскладки и панели в нём. */
  root: LayoutNode;
  panes: Record<string, Pane>;
  activePane: string;

  /** Зеркала активной панели — ими пользуется весь остальной интерфейс. */
  active: string | null;
  tabs: string[];

  drafts: Record<string, string>;
  dirty: Record<string, boolean>;
  /** Режим показа для конкретной вкладки; по умолчанию берётся из настроек. */
  modes: Record<string, EditorMode>;
  history: string[];
  historyIndex: number;

  openNote(path: string, options?: { inSplit?: boolean; replace?: boolean; pane?: string }): Promise<void>;
  closeTab(path: string, paneId?: string): Promise<void>;
  closeOthers(path: string, paneId?: string): Promise<void>;
  setActive(path: string, paneId?: string): void;
  setActivePane(paneId: string): void;
  /** Перенести вкладку: внутри панели (порядок) или в другую панель/новую. */
  moveTab(path: string, fromPane: string, toPane: string, index?: number): void;
  dropTab(path: string, fromPane: string, targetPane: string, zone: DropZone, index?: number): void;
  splitActive(dir: SplitDirection): void;
  closePane(paneId: string): void;
  setSizes(splitId: string, sizes: number[]): void;

  setMode(path: string, mode: EditorMode): void;
  modeOf(path: string): EditorMode;

  setDraft(path: string, text: string): void;
  flush(path?: string): Promise<void>;
  reloadClean(): Promise<void>;
  back(): void;
  forward(): void;
  canBack(): boolean;
  canForward(): boolean;
  renamed(from: string, to: string): void;
  removed(path: string): void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const FIRST_PANE = "p0";

function emptyPane(id: string): Pane {
  return { id, tabs: [], active: null };
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  root: { type: "pane", id: FIRST_PANE },
  panes: { [FIRST_PANE]: emptyPane(FIRST_PANE) },
  activePane: FIRST_PANE,
  active: null,
  tabs: [],
  drafts: {},
  dirty: {},
  modes: {},
  history: [],
  historyIndex: -1,

  async openNote(path, options = {}) {
    const vault = useVaultStore.getState();
    const text = isSpecialTab(path)
      ? ""
      : (get().drafts[path] ?? (await vault.readNote(path).catch(() => "")));

    set((state) => {
      let root = state.root;
      const panes = { ...state.panes };
      let paneId = options.pane ?? state.activePane;

      if (options.inSplit) {
        // Открыть рядом: если второй панели нет, делим активную пополам
        const existing = paneIds(root).find((id) => id !== state.activePane);
        if (existing) {
          paneId = existing;
        } else {
          paneId = makeId("p");
          panes[paneId] = emptyPane(paneId);
          root = insertBeside(root, state.activePane, "right", { type: "pane", id: paneId });
        }
      }

      const pane = panes[paneId] ?? emptyPane(paneId);
      let tabs = pane.tabs;
      if (!tabs.includes(path)) {
        tabs =
          options.replace && pane.active
            ? tabs.map((tab) => (tab === pane.active ? path : tab))
            : [...tabs, path];
      }
      panes[paneId] = { ...pane, tabs, active: path };

      const history = state.history.slice(0, state.historyIndex + 1);
      if (history[history.length - 1] !== path) history.push(path);

      return {
        root,
        panes,
        activePane: paneId,
        active: path,
        tabs,
        drafts: { ...state.drafts, [path]: text },
        history,
        historyIndex: history.length - 1,
      };
    });
  },

  async closeTab(path, paneId) {
    await get().flush(path);
    set((state) => {
      const id = paneId ?? state.activePane;
      const pane = state.panes[id];
      if (!pane) return state;
      const tabs = pane.tabs.filter((tab) => tab !== path);
      const panes = {
        ...state.panes,
        [id]: { ...pane, tabs, active: pane.active === path ? (tabs[tabs.length - 1] ?? null) : pane.active },
      };

      let root = state.root;
      let activePane = state.activePane;
      // Пустая панель исчезает, если она не последняя
      if (tabs.length === 0 && paneIds(root).length > 1) {
        root = replaceNode(root, id, null) ?? root;
        delete panes[id];
        activePane = paneIds(root)[0] ?? FIRST_PANE;
      }

      const drafts = { ...state.drafts };
      const dirty = { ...state.dirty };
      const stillOpen = Object.values(panes).some((item) => item.tabs.includes(path));
      if (!stillOpen) {
        delete drafts[path];
        delete dirty[path];
      }
      const activePaneData = panes[activePane];
      return {
        root,
        panes,
        activePane,
        drafts,
        dirty,
        active: activePaneData?.active ?? null,
        tabs: activePaneData?.tabs ?? [],
      };
    });
  },

  async closeOthers(path, paneId) {
    const id = paneId ?? get().activePane;
    for (const tab of [...(get().panes[id]?.tabs ?? [])]) {
      if (tab !== path) await get().closeTab(tab, id);
    }
  },

  setActive(path, paneId) {
    set((state) => {
      const id = paneId ?? state.activePane;
      const pane = state.panes[id];
      if (!pane) return state;
      const history = state.history.slice(0, state.historyIndex + 1);
      if (history[history.length - 1] !== path) history.push(path);
      const panes = { ...state.panes, [id]: { ...pane, active: path } };
      return {
        panes,
        activePane: id,
        active: path,
        tabs: panes[id].tabs,
        history,
        historyIndex: history.length - 1,
      };
    });
  },

  setActivePane(paneId) {
    set((state) => {
      const pane = state.panes[paneId];
      if (!pane) return state;
      return { activePane: paneId, active: pane.active, tabs: pane.tabs };
    });
  },

  moveTab(path, fromPane, toPane, index) {
    set((state) => {
      const panes = { ...state.panes };
      const source = panes[fromPane];
      const target = panes[toPane];
      if (!source || !target) return state;

      const sourceTabs = source.tabs.filter((tab) => tab !== path);
      const targetTabs = toPane === fromPane ? sourceTabs : target.tabs.filter((tab) => tab !== path);
      const at = index ?? targetTabs.length;
      targetTabs.splice(Math.max(0, Math.min(at, targetTabs.length)), 0, path);

      panes[fromPane] = {
        ...source,
        tabs: toPane === fromPane ? targetTabs : sourceTabs,
        active:
          toPane === fromPane
            ? path
            : source.active === path
              ? (sourceTabs[sourceTabs.length - 1] ?? null)
              : source.active,
      };
      if (toPane !== fromPane) panes[toPane] = { ...target, tabs: targetTabs, active: path };

      let root = state.root;
      let activePane = toPane;
      if (panes[fromPane].tabs.length === 0 && paneIds(root).length > 1 && fromPane !== toPane) {
        root = replaceNode(root, fromPane, null) ?? root;
        delete panes[fromPane];
      }
      if (!panes[activePane]) activePane = paneIds(root)[0] ?? FIRST_PANE;

      return {
        root,
        panes,
        activePane,
        active: panes[activePane]?.active ?? null,
        tabs: panes[activePane]?.tabs ?? [],
      };
    });
  },

  /** Бросок вкладки на панель: в центр — присоединить, к краю — разделить экран. */
  dropTab(path, fromPane, targetPane, zone, index) {
    if (zone === "center") {
      get().moveTab(path, fromPane, targetPane, index);
      return;
    }
    set((state) => {
      const panes = { ...state.panes };
      const source = panes[fromPane];
      if (!source) return state;
      // Единственную вкладку панели нет смысла бросать на её же край:
      // панель опустеет и схлопнется, экран не разделится.
      if (fromPane === targetPane && source.tabs.length < 2) return state;

      const newPaneId = makeId("p");
      panes[newPaneId] = { id: newPaneId, tabs: [path], active: path };
      const sourceTabs = source.tabs.filter((tab) => tab !== path);
      panes[fromPane] = {
        ...source,
        tabs: sourceTabs,
        active: source.active === path ? (sourceTabs[sourceTabs.length - 1] ?? null) : source.active,
      };

      let root = insertBeside(state.root, targetPane, zone, { type: "pane", id: newPaneId });
      if (sourceTabs.length === 0 && fromPane !== newPaneId) {
        root = replaceNode(root, fromPane, null) ?? root;
        delete panes[fromPane];
      }
      return {
        root,
        panes,
        activePane: newPaneId,
        active: path,
        tabs: [path],
      };
    });
  },

  splitActive(dir) {
    const state = get();
    const path = state.active;
    if (!path) return;
    state.dropTab(path, state.activePane, state.activePane, dir === "row" ? "right" : "bottom");
  },

  closePane(paneId) {
    set((state) => {
      if (paneIds(state.root).length <= 1) return state;
      const root = replaceNode(state.root, paneId, null) ?? state.root;
      const panes = { ...state.panes };
      delete panes[paneId];
      const activePane = paneIds(root)[0] ?? FIRST_PANE;
      return {
        root,
        panes,
        activePane,
        active: panes[activePane]?.active ?? null,
        tabs: panes[activePane]?.tabs ?? [],
      };
    });
  },

  setSizes(splitId, sizes) {
    set((state) => {
      const update = (node: LayoutNode): LayoutNode => {
        if (node.type !== "split") return node;
        if (node.id === splitId) return { ...node, sizes: normalize(sizes) };
        return { ...node, children: node.children.map(update) };
      };
      return { root: update(state.root) };
    });
  },

  setMode(path, mode) {
    set((state) => ({ modes: { ...state.modes, [path]: mode } }));
  },

  modeOf(path) {
    return get().modes[path] ?? settings().editor.defaultMode;
  },

  setDraft(path, text) {
    set((state) => ({ drafts: { ...state.drafts, [path]: text }, dirty: { ...state.dirty, [path]: true } }));
    const existing = timers.get(path);
    if (existing) clearTimeout(existing);
    timers.set(
      path,
      setTimeout(() => void get().flush(path), settings().editor.autosaveMs),
    );
  },

  /** Записать черновик на диск. Вызывается автосейвом, при закрытии вкладки и перед выходом. */
  async flush(path) {
    const targets = path ? [path] : Object.keys(get().dirty).filter((key) => get().dirty[key]);
    for (const target of targets) {
      const timer = timers.get(target);
      if (timer) {
        clearTimeout(timer);
        timers.delete(target);
      }
      const text = get().drafts[target];
      if (text === undefined || !get().dirty[target]) continue;
      await useVaultStore.getState().saveNote(target, text);
      set((state) => ({ dirty: { ...state.dirty, [target]: false } }));
    }
  },

  /** Перечитать открытые вкладки без несохранённых правок — после синхронизации. */
  async reloadClean() {
    const vault = useVaultStore.getState();
    const open = new Set(Object.values(get().panes).flatMap((pane) => pane.tabs));
    for (const path of open) {
      if (get().dirty[path]) continue;
      const text = await vault.readNote(path).catch(() => null);
      if (text === null || text === get().drafts[path]) continue;
      set((state) => ({ drafts: { ...state.drafts, [path]: text } }));
    }
  },

  back() {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const index = historyIndex - 1;
    const path = history[index];
    set({ historyIndex: index });
    void get().openNote(path, { replace: true });
  },

  forward() {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const index = historyIndex + 1;
    const path = history[index];
    set({ historyIndex: index });
    void get().openNote(path, { replace: true });
  },

  canBack() {
    return get().historyIndex > 0;
  },

  canForward() {
    return get().historyIndex < get().history.length - 1;
  },

  renamed(from, to) {
    set((state) => {
      const drafts = { ...state.drafts };
      if (drafts[from] !== undefined) {
        drafts[to] = drafts[from];
        delete drafts[from];
      }
      const panes = Object.fromEntries(
        Object.entries(state.panes).map(([id, pane]) => [
          id,
          {
            ...pane,
            tabs: pane.tabs.map((tab) => (tab === from ? to : tab)),
            active: pane.active === from ? to : pane.active,
          },
        ]),
      );
      return {
        panes,
        drafts,
        active: state.active === from ? to : state.active,
        tabs: panes[state.activePane]?.tabs ?? [],
        history: state.history.map((item) => (item === from ? to : item)),
      };
    });
  },

  removed(path) {
    set((state) => {
      const drafts = { ...state.drafts };
      delete drafts[path];
      const panes = Object.fromEntries(
        Object.entries(state.panes).map(([id, pane]) => {
          const tabs = pane.tabs.filter((tab) => tab !== path);
          return [
            id,
            { ...pane, tabs, active: pane.active === path ? (tabs[tabs.length - 1] ?? null) : pane.active },
          ];
        }),
      );
      const activePane = panes[state.activePane] ? state.activePane : (Object.keys(panes)[0] ?? FIRST_PANE);
      return {
        panes,
        drafts,
        activePane,
        active: panes[activePane]?.active ?? null,
        tabs: panes[activePane]?.tabs ?? [],
        history: state.history.filter((item) => item !== path),
      };
    });
  },
}));

/** Сохранить всё перед закрытием окна — иначе последние правки потеряются. */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void useEditorStore.getState().flush();
  });
}
