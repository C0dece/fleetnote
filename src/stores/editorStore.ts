import { create } from "zustand";
import { useVaultStore } from "./vaultStore";

const AUTOSAVE_MS = 600;

interface EditorStoreState {
  /** Открытые вкладки в порядке появления. */
  tabs: string[];
  active: string | null;
  /** Вторая панель для режима Split View (только ПК). */
  split: string | null;
  drafts: Record<string, string>;
  dirty: Record<string, boolean>;
  history: string[];
  historyIndex: number;

  openNote(path: string, options?: { inSplit?: boolean; replace?: boolean }): Promise<void>;
  closeTab(path: string): Promise<void>;
  closeOthers(path: string): Promise<void>;
  setActive(path: string): void;
  setSplit(path: string | null): void;
  setDraft(path: string, text: string): void;
  flush(path?: string): Promise<void>;
  back(): void;
  forward(): void;
  canBack(): boolean;
  canForward(): boolean;
  renamed(from: string, to: string): void;
  removed(path: string): void;
  reloadClean(): Promise<void>;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  tabs: [],
  active: null,
  split: null,
  drafts: {},
  dirty: {},
  history: [],
  historyIndex: -1,

  async openNote(path, options = {}) {
    const vault = useVaultStore.getState();
    const text = get().drafts[path] ?? (await vault.readNote(path).catch(() => ""));
    set((state) => {
      const tabs = state.tabs.includes(path)
        ? state.tabs
        : options.replace && state.active
          ? state.tabs.map((tab) => (tab === state.active ? path : tab))
          : [...state.tabs, path];
      const history = state.history.slice(0, state.historyIndex + 1);
      if (history[history.length - 1] !== path) history.push(path);
      return {
        tabs,
        drafts: { ...state.drafts, [path]: text },
        active: options.inSplit ? state.active : path,
        split: options.inSplit ? path : state.split,
        history,
        historyIndex: history.length - 1,
      };
    });
  },

  async closeTab(path) {
    await get().flush(path);
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab !== path);
      const drafts = { ...state.drafts };
      delete drafts[path];
      const dirty = { ...state.dirty };
      delete dirty[path];
      const active = state.active === path ? (tabs[tabs.length - 1] ?? null) : state.active;
      return { tabs, drafts, dirty, active, split: state.split === path ? null : state.split };
    });
  },

  async closeOthers(path) {
    for (const tab of get().tabs) if (tab !== path) await get().closeTab(tab);
  },

  setActive(path) {
    set((state) => {
      const history = state.history.slice(0, state.historyIndex + 1);
      if (history[history.length - 1] !== path) history.push(path);
      return { active: path, history, historyIndex: history.length - 1 };
    });
  },

  setSplit(split) {
    set({ split });
  },

  setDraft(path, text) {
    set((state) => ({ drafts: { ...state.drafts, [path]: text }, dirty: { ...state.dirty, [path]: true } }));
    const existing = timers.get(path);
    if (existing) clearTimeout(existing);
    timers.set(
      path,
      setTimeout(() => void get().flush(path), AUTOSAVE_MS),
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

  back() {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const index = historyIndex - 1;
    const path = history[index];
    set({ historyIndex: index, active: path });
    void get().openNote(path, { replace: true });
  },

  forward() {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const index = historyIndex + 1;
    const path = history[index];
    set({ historyIndex: index, active: path });
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
      return {
        tabs: state.tabs.map((tab) => (tab === from ? to : tab)),
        active: state.active === from ? to : state.active,
        split: state.split === from ? to : state.split,
        drafts,
        history: state.history.map((item) => (item === from ? to : item)),
      };
    });
  },

  /**
   * Перечитать с диска открытые вкладки, в которых нет несохранённых правок.
   * Нужно после синхронизации: иначе на экране остаётся версия до слияния.
   */
  async reloadClean() {
    const vault = useVaultStore.getState();
    for (const path of get().tabs) {
      if (get().dirty[path]) continue;
      const text = await vault.readNote(path).catch(() => null);
      if (text === null || text === get().drafts[path]) continue;
      set((state) => ({ drafts: { ...state.drafts, [path]: text } }));
    }
  },

  removed(path) {
    set((state) => {
      const drafts = { ...state.drafts };
      delete drafts[path];
      const tabs = state.tabs.filter((tab) => tab !== path);
      return {
        tabs,
        drafts,
        active: state.active === path ? (tabs[tabs.length - 1] ?? null) : state.active,
        split: state.split === path ? null : state.split,
        history: state.history.filter((item) => item !== path),
      };
    });
  },
}));

/** Сохранить всё перед закрытием окна — иначе последние 600 мс правок потеряются. */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void useEditorStore.getState().flush();
  });
}
