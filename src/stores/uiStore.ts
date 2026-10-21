import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "light" | "dark" | "amoled";
export type MobileSheet = "none" | "files" | "search" | "tabs" | "sync" | "outline";
export type RightTab = "backlinks" | "outline" | "graph";

interface UIState {
  theme: ThemeName;
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  rightTab: RightTab;
  /** Модальные окна. */
  palette: boolean;
  quickSwitch: boolean;
  settings: boolean;
  /** Мобильная шторка. */
  sheet: MobileSheet;
  /** Фильтр по тегу, выбранный кликом по `#тегу`. */
  tagFilter: string | null;
  /** Кегль текста заметки, px. */
  fontSize: number;

  setTheme(theme: ThemeName): void;
  toggleLeft(force?: boolean): void;
  toggleRight(force?: boolean): void;
  setLeftWidth(width: number): void;
  setRightWidth(width: number): void;
  setRightTab(tab: RightTab): void;
  setPalette(open: boolean): void;
  setQuickSwitch(open: boolean): void;
  setSettings(open: boolean): void;
  setSheet(sheet: MobileSheet): void;
  setTagFilter(tag: string | null): void;
  setFontSize(size: number): void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "dark",
      leftOpen: true,
      rightOpen: true,
      leftWidth: 260,
      rightWidth: 300,
      rightTab: "backlinks",
      palette: false,
      quickSwitch: false,
      settings: false,
      sheet: "none",
      tagFilter: null,
      fontSize: 16,

      setTheme: (theme) => set({ theme }),
      toggleLeft: (force) => set((state) => ({ leftOpen: force ?? !state.leftOpen })),
      toggleRight: (force) => set((state) => ({ rightOpen: force ?? !state.rightOpen })),
      setLeftWidth: (width) => set({ leftWidth: Math.min(480, Math.max(180, width)) }),
      setRightWidth: (width) => set({ rightWidth: Math.min(520, Math.max(200, width)) }),
      setRightTab: (rightTab) => set({ rightTab }),
      setPalette: (palette) => set({ palette }),
      setQuickSwitch: (quickSwitch) => set({ quickSwitch }),
      setSettings: (settings) => set({ settings }),
      setSheet: (sheet) => set({ sheet }),
      setTagFilter: (tagFilter) => set({ tagFilter, sheet: "none" }),
      setFontSize: (fontSize) => set({ fontSize: Math.min(22, Math.max(13, Math.round(fontSize))) }),
    }),
    {
      name: "fleetnote.ui.v1",
      partialize: (state) => ({
        theme: state.theme,
        leftOpen: state.leftOpen,
        rightOpen: state.rightOpen,
        leftWidth: state.leftWidth,
        rightWidth: state.rightWidth,
        rightTab: state.rightTab,
        fontSize: state.fontSize,
      }),
    },
  ),
);

/** Применить тему к документу: один источник правды для CSS-переменных. */
export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const color = theme === "light" ? "#FAF8F5" : theme === "amoled" ? "#000000" : "#0D0F12";
  root.style.colorScheme = theme === "light" ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}
