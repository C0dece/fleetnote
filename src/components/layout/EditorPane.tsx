import { useRef } from "react";
import { BookOpen, Code2, Eye } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore, type EditorMode } from "@/stores/settingsStore";
import { useIsMobileLayout } from "@/hooks/useMediaQuery";
import { useDialogStore } from "@/components/ui/dialogs";
import { Editor, type EditorHandle } from "@/components/editor/Editor";
import { ReadingView } from "@/components/editor/ReadingView";
import { NoteToolbar } from "@/components/editor/NoteToolbar";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";

export interface EditorPaneProps {
  path: string | null;
  paneId?: string;
  /** Ref нужен мобильному тулбару, чтобы выполнять команды форматирования. */
  handle?: React.RefObject<EditorHandle | null>;
}

const MODES: Array<{ id: EditorMode; label: string; icon: React.ReactNode; title: string }> = [
  { id: "source", label: "Исходник", icon: <Code2 size={14} />, title: "Показывать всю разметку" },
  {
    id: "live",
    label: "Превью",
    icon: <Eye size={14} />,
    title: "Живое превью: разметка видна на строке курсора",
  },
  { id: "reading", label: "Чтение", icon: <BookOpen size={14} />, title: "Только результат, без разметки" },
];

/** Обвязка редактора: режимы, инструменты, свойства, ссылки и вложения. */
export function EditorPane({ path, handle }: EditorPaneProps) {
  const fallback = useRef<EditorHandle | null>(null);
  const editorRef = handle ?? fallback;
  const draft = useEditorStore((state) => (path ? state.drafts[path] : undefined));
  const setDraft = useEditorStore((state) => state.setDraft);
  const openNote = useEditorStore((state) => state.openNote);
  const modes = useEditorStore((state) => state.modes);
  const setMode = useEditorStore((state) => state.setMode);
  const vault = useVaultStore();
  const setTagFilter = useUIStore((state) => state.setTagFilter);
  const setSheet = useUIStore((state) => state.setSheet);
  const confirm = useDialogStore((state) => state.confirm);
  const editorSettings = useSettingsStore((state) => state.editor);
  const isMobile = useIsMobileLayout();

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

  const text = draft ?? "";
  const mode = modes[path] ?? editorSettings.defaultMode;

  const openLink = async (target: string) => {
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
  };

  const openTag = (tag: string) => {
    setTagFilter(tag);
    setSheet("search");
  };

  /** Отметка задачи в режиме чтения меняет исходный текст заметки. */
  const toggleTask = (index: number, checked: boolean) => {
    let seen = -1;
    const next = text
      .split("\n")
      .map((line) => {
        const match = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]/.exec(line);
        if (!match) return line;
        seen += 1;
        if (seen !== index) return line;
        return `${match[1]}[${checked ? "x" : " "}]${line.slice(match[0].length)}`;
      })
      .join("\n");
    if (next !== text) setDraft(path, next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 px-2 py-1">
        <div className="flex items-center gap-0.5 rounded-lg border p-0.5 hairline">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.title}
              onClick={() => setMode(path, item.id)}
              className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] ${
                mode === item.id ? "bg-accent-soft text-ink" : "text-muted hover:bg-hover"
              }`}
            >
              {item.icon}
              {!isMobile && item.label}
            </button>
          ))}
        </div>
        <span className="ml-auto truncate text-[11.5px] text-muted">{path}</span>
      </div>

      {editorSettings.showToolbar && mode !== "reading" && !isMobile && <NoteToolbar editor={editorRef} />}
      {editorSettings.showProperties && mode !== "reading" && (
        <PropertiesPanel text={text} onChange={(next) => setDraft(path, next)} />
      )}

      <div className="min-h-0 flex-1">
        {mode === "reading" ? (
          <ReadingView text={text} onOpenLink={openLink} onOpenTag={openTag} onToggleTask={toggleTask} />
        ) : (
          <Editor
            ref={editorRef}
            path={path}
            value={text}
            mode={mode === "source" ? "source" : "live"}
            spellcheck={editorSettings.spellcheck}
            hideFrontmatter={editorSettings.showProperties}
            indentSize={editorSettings.indentSize}
            slashMenu={editorSettings.slashMenu}
            onChange={(next) => setDraft(path, next)}
            notes={() => vault.notes.map((note) => ({ title: note.title, path: note.path }))}
            tags={() => vault.tags}
            onOpenTag={openTag}
            onOpenLink={openLink}
            onPasteFile={(file) => vault.saveAttachment(file)}
          />
        )}
      </div>
    </div>
  );
}
