import { X } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";

export function TabStrip() {
  const tabs = useEditorStore((state) => state.tabs);
  const active = useEditorStore((state) => state.active);
  const dirty = useEditorStore((state) => state.dirty);
  const setActive = useEditorStore((state) => state.setActive);
  const closeTab = useEditorStore((state) => state.closeTab);
  const notes = useVaultStore((state) => state.manager?.notes);

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-9 shrink-0 items-stretch gap-1 overflow-x-auto border-b bg-canvas px-1 hairline">
      {tabs.map((path) => {
        const title = notes?.get(path)?.title ?? path.split("/").pop() ?? path;
        const isActive = path === active;
        return (
          <div
            key={path}
            className={`group flex min-w-0 max-w-56 items-center gap-1 rounded-t-lg px-2 text-[13px] ${
              isActive ? "bg-panel text-ink" : "text-muted hover:bg-hover"
            }`}
          >
            <button
              type="button"
              onClick={() => setActive(path)}
              className="min-w-0 flex-1 truncate py-1 text-left"
            >
              {title}
              {dirty[path] && <span className="ml-1 text-accent">•</span>}
            </button>
            <button
              type="button"
              aria-label="Закрыть вкладку"
              onClick={() => void closeTab(path)}
              className="shrink-0 rounded p-0.5 text-muted opacity-0 hover:bg-hover hover:text-ink group-hover:opacity-100"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
