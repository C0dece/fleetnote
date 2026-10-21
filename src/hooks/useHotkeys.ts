import { useEffect } from "react";

export interface Hotkey {
  /** `mod+k`, `mod+shift+o`, `escape`. `mod` — Cmd на macOS, Ctrl на остальных. */
  combo: string;
  handler: (event: KeyboardEvent) => void;
  /** Работать ли, когда фокус в поле ввода или редакторе. */
  allowInInput?: boolean;
}

export function useHotkeys(hotkeys: Hotkey[]): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inInput =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      for (const hotkey of hotkeys) {
        if (!matches(hotkey.combo, event)) continue;
        if (inInput && !hotkey.allowInInput && !hotkey.combo.includes("escape")) continue;
        event.preventDefault();
        hotkey.handler(event);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hotkeys]);
}

function matches(combo: string, event: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const needMod = parts.includes("mod");
  const needShift = parts.includes("shift");
  const needAlt = parts.includes("alt");
  const mod = event.metaKey || event.ctrlKey;
  if (needMod !== mod) return false;
  if (needShift !== event.shiftKey) return false;
  if (needAlt !== event.altKey) return false;
  const pressed = event.key.toLowerCase();
  return pressed === key || (key === "escape" && pressed === "esc");
}
