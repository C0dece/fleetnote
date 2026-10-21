import { ChevronRight, Hash, Heading1, Heading2, Link2, List, ListChecks, Redo2, Undo2 } from "lucide-react";
import { redo, undo } from "@codemirror/commands";
import type { StateCommand } from "@codemirror/state";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import {
  cycleHeading,
  insertTag,
  insertWikiLink,
  setHeading,
  toggleBold,
  toggleInlineCode,
  toggleItalic,
  toggleTask,
} from "./extensions/commands";
import type { EditorHandle } from "./Editor";

const indentList: StateCommand = ({ state, dispatch }) => {
  const line = state.doc.lineAt(state.selection.main.head);
  dispatch(state.update({ changes: { from: line.from, insert: "  " }, userEvent: "input.indent" }));
  return true;
};

/**
 * Полоска быстрой разметки, приклеенная к верхнему краю экранной клавиатуры.
 * Без неё на телефоне недоступна половина синтаксиса: `[[`, `#`, `- [ ]`, заголовки.
 */
export function MobileKeyboardToolbar({ editor }: { editor: React.RefObject<EditorHandle | null> }) {
  const viewport = useVisualViewport();
  if (!viewport.keyboardOpen) return null;

  const run = (command: StateCommand) => (event: React.PointerEvent) => {
    // Не отдаём фокус: иначе клавиатура закроется и полоска исчезнет.
    event.preventDefault();
    editor.current?.run(command);
  };

  const buttons: Array<{ label: string; command: StateCommand; icon?: React.ReactNode }> = [
    { label: "[[ ]]", command: insertWikiLink, icon: <Link2 size={16} /> },
    { label: "#", command: insertTag, icon: <Hash size={16} /> },
    { label: "- [ ]", command: toggleTask, icon: <ListChecks size={16} /> },
    { label: "B", command: toggleBold },
    { label: "I", command: toggleItalic },
    { label: "`", command: toggleInlineCode },
    { label: "H1", command: setHeading(1), icon: <Heading1 size={16} /> },
    { label: "H2", command: setHeading(2), icon: <Heading2 size={16} /> },
    { label: "H", command: cycleHeading },
    { label: "–", command: indentList, icon: <List size={16} /> },
    { label: "Tab", command: indentList, icon: <ChevronRight size={16} /> },
    { label: "Undo", command: undo, icon: <Undo2 size={16} /> },
    { label: "Redo", command: redo, icon: <Redo2 size={16} /> },
  ];

  return (
    <div
      className="fixed left-0 right-0 z-40 flex gap-1 overflow-x-auto border-t bg-panel px-2 py-1.5 hairline"
      style={{ bottom: viewport.keyboardHeight, scrollbarWidth: "none" }}
      role="toolbar"
      aria-label="Быстрая разметка"
    >
      {buttons.map((button, index) => (
        <button
          key={`${button.label}-${index}`}
          type="button"
          onPointerDown={run(button.command)}
          className="flex h-9 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg bg-panel-2 px-2.5 text-sm text-ink active:bg-accent-soft"
        >
          {button.icon}
          {!button.icon && <span>{button.label}</span>}
        </button>
      ))}
    </div>
  );
}
