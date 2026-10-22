import type { StateCommand } from "@codemirror/state";
import { redo, undo } from "@codemirror/commands";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Table,
  Undo2,
} from "lucide-react";
import {
  insertTag,
  insertWikiLink,
  setHeading,
  toggleBold,
  toggleInlineCode,
  toggleItalic,
  toggleTask,
  insertBlock,
  toggleQuote,
  toggleBullet,
  toggleOrdered,
} from "./extensions/commands";
import type { EditorHandle } from "./Editor";

interface Tool {
  key: string;
  title: string;
  icon: React.ReactNode;
  command: StateCommand;
}

const TOOLS: Tool[] = [
  { key: "h1", title: "Заголовок 1", icon: <Heading1 size={15} />, command: setHeading(1) },
  { key: "h2", title: "Заголовок 2", icon: <Heading2 size={15} />, command: setHeading(2) },
  { key: "h3", title: "Заголовок 3", icon: <Heading3 size={15} />, command: setHeading(3) },
  { key: "bold", title: "Жирный (Ctrl/Cmd+B)", icon: <Bold size={15} />, command: toggleBold },
  { key: "italic", title: "Курсив (Ctrl/Cmd+I)", icon: <Italic size={15} />, command: toggleItalic },
  { key: "code", title: "Моноширинный", icon: <Code size={15} />, command: toggleInlineCode },
  { key: "bullet", title: "Список", icon: <List size={15} />, command: toggleBullet },
  { key: "ordered", title: "Нумерованный список", icon: <ListOrdered size={15} />, command: toggleOrdered },
  { key: "task", title: "Задача", icon: <ListChecks size={15} />, command: toggleTask },
  { key: "quote", title: "Цитата", icon: <Quote size={15} />, command: toggleQuote },
  { key: "divider", title: "Разделитель", icon: <Minus size={15} />, command: insertBlock("\n---\n\n") },
  {
    key: "table",
    title: "Таблица",
    icon: <Table size={15} />,
    command: insertBlock("\n| Колонка | Колонка |\n| --- | --- |\n|  |  |\n\n"),
  },
  { key: "link", title: "Ссылка на заметку", icon: <Link2 size={15} />, command: insertWikiLink },
  { key: "tag", title: "Тег", icon: <span className="text-[13px]">#</span>, command: insertTag },
  { key: "undo", title: "Отменить", icon: <Undo2 size={15} />, command: undo },
  { key: "redo", title: "Повторить", icon: <Redo2 size={15} />, command: redo },
];

/** Панель быстрых вставок над текстом: то же, что в меню «/», но в один клик. */
export function NoteToolbar({ editor }: { editor: React.RefObject<EditorHandle | null> }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-canvas px-2 py-1 hairline">
      {TOOLS.map((tool) => (
        <button
          key={tool.key}
          type="button"
          title={tool.title}
          aria-label={tool.title}
          onMouseDown={(event) => {
            event.preventDefault();
            editor.current?.run(tool.command);
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
