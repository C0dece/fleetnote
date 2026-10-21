import { useEffect, useMemo } from "react";
import { applyTheme, useUIStore } from "@/stores/uiStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useHotkeys, type Hotkey } from "@/hooks/useHotkeys";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { Welcome } from "@/components/layout/Welcome";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { Dialogs } from "@/components/ui/dialogs";
import { dirname } from "@/core/fs/paths";

export default function App() {
  const theme = useUIStore((state) => state.theme);
  const fontSize = useUIStore((state) => state.fontSize);
  const mode = useVaultStore((state) => state.mode);
  const restoreLast = useVaultStore((state) => state.restoreLast);

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--fn-editor-font-size", `${fontSize}px`);
  }, [fontSize]);

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
      {mode === "ready" ? <AdaptiveShell /> : <Welcome />}
      <CommandPalette mode="commands" />
      <CommandPalette mode="notes" />
      <SettingsDialog />
      <Dialogs />
    </>
  );
}
