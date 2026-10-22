import {
  ChevronRight,
  Hash,
  Heading1,
  Heading2,
  Link2,
  ListChecks,
  Quote,
  Redo2,
  Table,
  Undo2,
} from "lucide-react";
import { redo, undo } from "@codemirror/commands";
import type { StateCommand } from "@codemirror/state";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  cycleHeading,
  insertBlock,
  insertTag,
  insertWikiLink,
  setHeading,
  toggleBold,
  toggleInlineCode,
  toggleItalic,
  toggleQuote,
  toggleTask,
} from "./extensions/commands";
import type { EditorHandle } from "./Editor";

const indentList: StateCommand = ({ state, dispatch }) => {
  const line = state.doc.lineAt(state.selection.main.head);
  dispatch(state.update({ changes: { from: line.from, insert: "  " }, userEvent: "input.indent" }));
  return true;
};

/** Кнопки тулбара: состав выбирается в настройках, порядок — как в списке. */
const BUTTONS: Record<string, { label: string; icon?: React.ReactNode; command: StateCommand }> = {
  link: { label: "[[ ]]", icon: <Link2 size={16} />, command: insertWikiLink },
  tag: { label: "#", icon: <Hash size={16} />, command: insertTag },
  task: { label: "- [ ]", icon: <ListChecks size={16} />, command: toggleTask },
  bold: { label: "B", command: toggleBold },
  italic: { label: "I", command: toggleItalic },
  code: { label: "`", command: toggleInlineCode },
  h1: { label: "H1", icon: <Heading1 size={16} />, command: setHeading(1) },
  h2: { label: "H2", icon: <Heading2 size={16} />, command: setHeading(2) },
  heading: { label: "H", command: cycleHeading },
  quote: { label: "»", icon: <Quote size={16} />, command: toggleQuote },
  divider: { label: "---", command: insertBlock("\n---\n\n") },
  table: {
    label: "Таблица",
    icon: <Table size={16} />,
    command: insertBlock("\n| Колонка | Колонка |\n| --- | --- |\n|  |  |\n\n"),
  },
  indent: { label: "Tab", icon: <ChevronRight size={16} />, command: indentList },
  undo: { label: "Undo", icon: <Undo2 size={16} />, command: undo },
  redo: { label: "Redo", icon: <Redo2 size={16} />, command: redo },
};

/**
 * Полоска быстрой разметки, приклеенная к верхнему краю экранной клавиатуры.
 * Без неё на телефоне недоступна половина синтаксиса.
 */
export function MobileKeyboardToolbar({ editor }: { editor: React.RefObject<EditorHandle | null> }) {
  const viewport = useVisualViewport();
  const keys = useSettingsStore((state) => state.mobile.toolbarButtons);
  if (!viewport.keyboardOpen) return null;

  const run = (command: StateCommand) => (event: React.PointerEvent) => {
    // Не отдаём фокус: иначе клавиатура закроется и полоска исчезнет.
    event.preventDefault();
    editor.current?.run(command);
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 flex gap-1 overflow-x-auto border-t bg-panel px-2 py-1.5 hairline"
      style={{ bottom: viewport.keyboardHeight, scrollbarWidth: "none" }}
      role="toolbar"
      aria-label="Быстрая разметка"
    >
      {keys
        .map((key) => ({ key, button: BUTTONS[key] }))
        .filter((item) => item.button)
        .map(({ key, button }) => (
          <button
            key={key}
            type="button"
            title={button.label}
            onPointerDown={run(button.command)}
            className="flex h-9 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg bg-panel-2 px-2.5 text-sm text-ink active:bg-accent-soft"
          >
            {button.icon ?? <span>{button.label}</span>}
          </button>
        ))}
    </div>
  );
}
