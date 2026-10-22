import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "light" | "dark" | "amoled" | "system";
export type EditorMode = "source" | "live" | "reading";
export type WindowFrame = "native" | "custom";
export type SyncDirection = "both" | "push" | "pull";
export type ConflictPolicy = "merge" | "keep-local" | "keep-remote" | "copy";
export type SortBy = "name" | "modified" | "created";

export interface AppearanceSettings {
  theme: ThemeName;
  accent: string;
  fontSans: string;
  fontMono: string;
  /** Кегль текста заметки, px. */
  fontSize: number;
  lineHeight: number;
  /** Ширина колонки текста в символах (ch). */
  measure: number;
  /** Растянуть текст на всю ширину панели, игнорируя measure. */
  fullWidth: boolean;
  /** Масштаб интерфейса: шрифты и отступы панелей. */
  uiScale: number;
  showStatusBar: boolean;
  showTabStrip: boolean;
  windowFrame: WindowFrame;
}

export interface EditorSettings {
  defaultMode: EditorMode;
  autosaveMs: number;
  indentSize: number;
  spellcheck: boolean;
  autoPairBrackets: boolean;
  /** Панель быстрых вставок над редактором (ПК). */
  showToolbar: boolean;
  /** Меню вставки по вводу «/». */
  slashMenu: boolean;
  /** Показывать панель свойств заметки. */
  showProperties: boolean;
  foldHeadings: boolean;
}

export interface VaultSettings {
  attachmentsFolder: string;
  dailyFolder: string;
  dailyFormat: string;
  newNoteLocation: "root" | "current";
  confirmDelete: boolean;
  sortBy: SortBy;
  sortDesc: boolean;
  showFileExtensions: boolean;
}

export interface SyncSettings {
  auto: boolean;
  intervalMin: number;
  direction: SyncDirection;
  conflict: ConflictPolicy;
  syncOnStart: boolean;
  pushDebounceMs: number;
}

export interface MobileSettings {
  bottomNav: string[];
  toolbarButtons: string[];
  touchRowHeight: number;
}

export interface Settings {
  appearance: AppearanceSettings;
  editor: EditorSettings;
  vault: VaultSettings;
  sync: SyncSettings;
  mobile: MobileSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: {
    theme: "dark",
    accent: "#6366F1",
    fontSans: '"Inter", "SF Pro Text", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    fontMono: '"JetBrains Mono", "SF Mono", "Cascadia Mono", ui-monospace, monospace',
    fontSize: 16,
    lineHeight: 1.65,
    measure: 65,
    fullWidth: false,
    uiScale: 1,
    showStatusBar: true,
    showTabStrip: true,
    windowFrame: "native",
  },
  editor: {
    defaultMode: "live",
    autosaveMs: 600,
    indentSize: 2,
    spellcheck: true,
    autoPairBrackets: true,
    showToolbar: true,
    slashMenu: true,
    showProperties: true,
    foldHeadings: true,
  },
  vault: {
    attachmentsFolder: "attachments",
    dailyFolder: "Daily",
    dailyFormat: "YYYY-MM-DD",
    newNoteLocation: "current",
    confirmDelete: true,
    sortBy: "name",
    sortDesc: false,
    showFileExtensions: false,
  },
  sync: {
    auto: true,
    intervalMin: 5,
    direction: "both",
    conflict: "merge",
    syncOnStart: true,
    pushDebounceMs: 1500,
  },
  mobile: {
    bottomNav: ["files", "search", "new", "tabs", "sync"],
    toolbarButtons: [
      "link",
      "tag",
      "task",
      "bold",
      "italic",
      "code",
      "h1",
      "h2",
      "quote",
      "indent",
      "undo",
      "redo",
    ],
    touchRowHeight: 44,
  },
};

type Section = keyof Settings;

interface SettingsState extends Settings {
  /** Точечное изменение: `set("appearance", { fontSize: 18 })`. */
  set<S extends Section>(section: S, patch: Partial<Settings[S]>): void;
  resetSection(section: Section): void;
  resetAll(): void;
  export(): string;
  import(json: string): boolean;
}

/** Глубокое слияние с значениями по умолчанию: новые ключи появляются у тех, кто обновился. */
function mergeDefaults(saved: Partial<Settings> | undefined): Settings {
  const out = structuredClone(DEFAULT_SETTINGS);
  if (!saved) return out;
  for (const key of Object.keys(out) as Section[]) {
    const section = saved[key];
    if (section && typeof section === "object") Object.assign(out[key], section);
  }
  return out;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...structuredClone(DEFAULT_SETTINGS),

      set(section, patch) {
        set((state) => ({ [section]: { ...state[section], ...patch } }) as Partial<SettingsState>);
      },

      resetSection(section) {
        set({ [section]: structuredClone(DEFAULT_SETTINGS[section]) } as Partial<SettingsState>);
      },

      resetAll() {
        set(structuredClone(DEFAULT_SETTINGS) as Partial<SettingsState>);
      },

      export() {
        const { appearance, editor, vault, sync, mobile } = get();
        return JSON.stringify({ appearance, editor, vault, sync, mobile }, null, 2);
      },

      import(json) {
        try {
          const parsed = JSON.parse(json) as Partial<Settings>;
          set(mergeDefaults(parsed) as Partial<SettingsState>);
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: "fleetnote.settings.v1",
      version: 1,
      merge: (persisted, current) => ({ ...current, ...mergeDefaults(persisted as Partial<Settings>) }),
      partialize: (state) => ({
        appearance: state.appearance,
        editor: state.editor,
        vault: state.vault,
        sync: state.sync,
        mobile: state.mobile,
      }),
    },
  ),
);

/** Снимок настроек вне React (сторы, движок синхронизации, расширения редактора). */
export function settings(): Settings {
  const { appearance, editor, vault, sync, mobile } = useSettingsStore.getState();
  return { appearance, editor, vault, sync, mobile };
}
