import { useEffect, useState } from "react";
import { isTauri } from "@/core/fs";
import { useVaultStore } from "@/stores/vaultStore";

/**
 * Приём файлов, перетащенных из проводника или рабочего стола.
 * В приложении событие приходит от Tauri (с путями), в браузере — обычным drop.
 */
export function useOsFileDrop(folder?: string): boolean {
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (isTauri()) {
      let dispose: (() => void) | undefined;
      void (async () => {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        dispose = await getCurrentWebview().onDragDropEvent((event) => {
          const payload = event.payload as { type: string; paths?: string[] };
          if (payload.type === "over" || payload.type === "enter") setOver(true);
          else if (payload.type === "leave") setOver(false);
          else if (payload.type === "drop") {
            setOver(false);
            if (payload.paths?.length) void useVaultStore.getState().importPaths(payload.paths, folder);
          }
        });
      })();
      return () => dispose?.();
    }

    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      setOver(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget) return;
      setOver(false);
    };
    const onDrop = (event: DragEvent) => {
      const files = [...(event.dataTransfer?.files ?? [])];
      if (!files.length) return;
      event.preventDefault();
      setOver(false);
      void useVaultStore.getState().importFiles(files, folder);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [folder]);

  return over;
}
