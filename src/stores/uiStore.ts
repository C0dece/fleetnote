import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MobileSheet = "none" | "files" | "search" | "tabs" | "sync" | "outline";
export type RightTab = "backlinks" | "outline" | "graph" | "properties";

/** Состояние интерфейса: что открыто прямо сейчас. Настройки живут в settingsStore. */
interface UIState {
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  rightTab: RightTab;

  palette: boolean;
  quickSwitch: boolean;
  settings: boolean;
  /** Открытый раздел настроек. */
  settingsSection: string;
  sheet: MobileSheet;
  /** Фильтр по тегу, выбранный кликом по `#тегу`. */
  tagFilter: string | null;

  toggleLeft(force?: boolean): void;
  toggleRight(force?: boolean): void;
  setLeftWidth(width: number): void;
  setRightWidth(width: number): void;
  setRightTab(tab: RightTab): void;
  setPalette(open: boolean): void;
  setQuickSwitch(open: boolean): void;
  setSettings(open: boolean, section?: string): void;
  setSheet(sheet: MobileSheet): void;
  setTagFilter(tag: string | null): void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      leftOpen: true,
      rightOpen: true,
      leftWidth: 268,
      rightWidth: 300,
      rightTab: "backlinks",
      palette: false,
      quickSwitch: false,
      settings: false,
      settingsSection: "appearance",
      sheet: "none",
      tagFilter: null,

      toggleLeft: (force) => set((state) => ({ leftOpen: force ?? !state.leftOpen })),
      toggleRight: (force) => set((state) => ({ rightOpen: force ?? !state.rightOpen })),
      setLeftWidth: (width) => set({ leftWidth: Math.min(520, Math.max(180, width)) }),
      setRightWidth: (width) => set({ rightWidth: Math.min(560, Math.max(200, width)) }),
      setRightTab: (rightTab) => set({ rightTab }),
      setPalette: (palette) => set({ palette }),
      setQuickSwitch: (quickSwitch) => set({ quickSwitch }),
      setSettings: (settings, section) =>
        set(section ? { settings, settingsSection: section } : { settings }),
      setSheet: (sheet) => set({ sheet }),
      setTagFilter: (tagFilter) => set({ tagFilter, sheet: "none" }),
    }),
    {
      name: "fleetnote.ui.v2",
      partialize: (state) => ({
        leftOpen: state.leftOpen,
        rightOpen: state.rightOpen,
        leftWidth: state.leftWidth,
        rightWidth: state.rightWidth,
        rightTab: state.rightTab,
      }),
    },
  ),
);
