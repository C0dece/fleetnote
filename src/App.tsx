import { useEffect, useMemo } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { applyAppearance } from "@/core/theme";
import { applyWindowFrame, ResizeEdges } from "@/components/layout/WindowChrome";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useHotkeys, type Hotkey } from "@/hooks/useHotkeys";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { VaultChooser } from "@/components/layout/VaultChooser";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { Dialogs } from "@/components/ui/dialogs";
import { dirname } from "@/core/fs/paths";

export default function App() {
  const appearance = useSettingsStore((state) => state.appearance);
  const mode = useVaultStore((state) => state.mode);
  const restoreLast = useVaultStore((state) => state.restoreLast);

  useEffect(() => applyAppearance(appearance), [appearance]);

  // Системная тема может переключиться во время работы приложения
  useEffect(() => {
    if (appearance.theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyAppearance(appearance);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [appearance]);

  useEffect(() => {
    void applyWindowFrame(appearance.windowFrame);
  }, [appearance.windowFrame]);

  useEffect(() => {
    void restoreLast();
  }, [restoreLast]);

  const hotkeys = useMemo<Hotkey[]>(
    () => [
      {
        combo: "mod+k",
        allowInInput: true,
        handler: () => useUIStore.getState().setPalette(true),
      },
      {
        combo: "mod+p",
        allowInInput: true,
        handler: () => useUIStore.getState().setPalette(true),
      },
      {
        combo: "mod+o",
        allowInInput: true,
        handler: () => useUIStore.getState().setQuickSwitch(true),
      },
      {
        combo: "mod+n",
        allowInInput: true,
        handler: async () => {
          const editor = useEditorStore.getState();
          const folder = editor.active ? dirname(editor.active) : "";
          const path = await useVaultStore.getState().createNote(folder);
          if (path) await editor.openNote(path);
        },
      },
      {
        combo: "mod+\\",
        allowInInput: true,
        handler: () => useUIStore.getState().toggleLeft(),
      },
      {
        combo: "mod+s",
        allowInInput: true,
        handler: () => void useEditorStore.getState().flush(),
      },
      {
        combo: "escape",
        allowInInput: true,
        handler: () => {
          const ui = useUIStore.getState();
          ui.setPalette(false);
          ui.setQuickSwitch(false);
          ui.setSettings(false);
          ui.setSheet("none");
        },
      },
    ],
    [],
  );

  useHotkeys(hotkeys);

  return (
    <>
      {mode === "ready" ? <AdaptiveShell /> : <VaultChooser />}
      <ResizeEdges />
      <CommandPalette mode="commands" />
      <CommandPalette mode="notes" />
      <SettingsDialog />
      <Dialogs />
    </>
  );
}
