import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";

/** Оглавление: заголовки открытой заметки с переходом к строке. */
export function Outline({ path }: { path: string | null }) {
  const headings = useVaultStore((state) => (path ? (state.manager?.notes.get(path)?.headings ?? []) : []));
  const draft = useEditorStore((state) => (path ? state.drafts[path] : undefined));

  if (!path) return <p className="px-3 py-3 text-[12.5px] text-muted">Откройте заметку</p>;
  if (!headings.length) return <p className="px-3 py-3 text-[12.5px] text-muted">В заметке нет заголовков</p>;

  const scrollTo = (line: number) => {
    // Ищем строку в DOM редактора: CodeMirror рендерит только видимые строки,
    // поэтому сначала прокручиваем пропорционально, затем уточняем.
    const editor = document.querySelector<HTMLElement>(`[data-fn-editor="${CSS.escape(path)}"] .cm-scroller`);
    if (!editor) return;
    const total = (draft ?? "").split("\n").length || 1;
    editor.scrollTo({ top: (editor.scrollHeight * line) / total, behavior: "smooth" });
  };

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-1">
      {headings.map((heading, index) => (
        <button
          key={`${heading.line}-${index}`}
          type="button"
          onClick={() => scrollTo(heading.line)}
          className="truncate rounded-lg px-2 py-1 text-left text-[13px] text-muted hover:bg-hover hover:text-ink"
          style={{ paddingLeft: 8 + (heading.level - 1) * 12 }}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );
}
