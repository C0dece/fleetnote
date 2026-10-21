import { useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { useDialogStore } from "@/components/ui/dialogs";
import { Editor, type EditorHandle } from "@/components/editor/Editor";

export interface EditorPaneProps {
  path: string | null;
  /** Ref нужен мобильному тулбару, чтобы выполнять команды форматирования. */
  handle?: React.RefObject<EditorHandle | null>;
}

/** Обвязка редактора: ссылки, теги, вложения и автосохранение. */
export function EditorPane({ path, handle }: EditorPaneProps) {
  const fallback = useRef<EditorHandle | null>(null);
  const editorRef = handle ?? fallback;
  const draft = useEditorStore((state) => (path ? state.drafts[path] : undefined));
  const setDraft = useEditorStore((state) => state.setDraft);
  const openNote = useEditorStore((state) => state.openNote);
  const vault = useVaultStore();
  const setTagFilter = useUIStore((state) => state.setTagFilter);
  const setSheet = useUIStore((state) => state.setSheet);
  const confirm = useDialogStore((state) => state.confirm);

  if (!path) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[15px] text-ink">Заметка не открыта</p>
        <p className="text-[13px] text-muted">
          Откройте заметку из дерева, нажмите <kbd className="text-ink">Ctrl/Cmd + O</kbd> для поиска или{" "}
          <kbd className="text-ink">Ctrl/Cmd + N</kbd>, чтобы создать новую.
        </p>
      </div>
    );
  }

  return (
    <Editor
      ref={editorRef}
      path={path}
      value={draft ?? ""}
      onChange={(text) => setDraft(path, text)}
      notes={() => vault.notes.map((note) => ({ title: note.title, path: note.path }))}
      tags={() => vault.tags}
      onOpenTag={(tag) => {
        setTagFilter(tag);
        setSheet("search");
      }}
      onOpenLink={async (target) => {
        const resolved = vault.resolveLink(target, path);
        if (resolved) {
          await openNote(resolved);
          return;
        }
        const create = await confirm({
          title: `Заметки «${target}» ещё нет`,
          message: "Создать её сейчас?",
          confirmLabel: "Создать",
        });
        if (!create) return;
        const created = await vault.createFromLink(target, path);
        if (created) await openNote(created);
      }}
      onPasteFile={(file) => vault.saveAttachment(file)}
    />
  );
}
