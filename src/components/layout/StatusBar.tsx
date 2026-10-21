import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import { SyncBadge } from "./SyncBadge";

export function StatusBar() {
  const notes = useVaultStore((state) => state.notes);
  const progress = useVaultStore((state) => state.progress);
  const active = useEditorStore((state) => state.active);
  const draft = useEditorStore((state) => (state.active ? state.drafts[state.active] : undefined));

  const words = draft ? (draft.trim().match(/[\p{L}\p{N}'’-]+/gu)?.length ?? 0) : 0;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t bg-panel px-3 text-[11.5px] text-muted hairline">
      <span className="tabular-nums">{notes.length} заметок</span>
      {progress && (
        <span className="tabular-nums">
          индексация {progress.done}/{progress.total}
        </span>
      )}
      {active && <span className="min-w-0 flex-1 truncate">{active}</span>}
      {!active && <span className="flex-1" />}
      {active && <span className="tabular-nums">{words} слов</span>}
      <SyncBadge />
    </footer>
  );
}
