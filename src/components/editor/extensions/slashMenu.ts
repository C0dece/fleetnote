import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";

interface SlashItem {
  label: string;
  detail: string;
  /** Текст вставки; `|` отмечает, где окажется курсор. */
  insert: string;
}

const ITEMS: SlashItem[] = [
  { label: "Заголовок 1", detail: "# ", insert: "# |" },
  { label: "Заголовок 2", detail: "## ", insert: "## |" },
  { label: "Заголовок 3", detail: "### ", insert: "### |" },
  { label: "Список", detail: "- ", insert: "- |" },
  { label: "Нумерованный список", detail: "1. ", insert: "1. |" },
  { label: "Задача", detail: "- [ ] ", insert: "- [ ] |" },
  { label: "Цитата", detail: "> ", insert: "> |" },
  { label: "Разделитель", detail: "---", insert: "---\n\n|" },
  { label: "Таблица", detail: "сетка 2×2", insert: "| Колонка | Колонка |\n| --- | --- |\n| | |\n\n|" },
  { label: "Блок кода", detail: "```", insert: "```\n|\n```" },
  { label: "Выноска: заметка", detail: "> [!note]", insert: "> [!note]\n> |" },
  { label: "Выноска: важно", detail: "> [!warning]", insert: "> [!warning]\n> |" },
  { label: "Ссылка на заметку", detail: "[[ ]]", insert: "[[|]]" },
  { label: "Тег", detail: "#", insert: "#|" },
  { label: "Сегодняшняя дата", detail: new Date().toLocaleDateString("ru-RU"), insert: `${isoToday()}|` },
  { label: "Время", detail: "чч:мм", insert: `${isoTime()}|` },
];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

/**
 * Меню вставки по «/»: быстрый доступ к заголовкам, спискам, таблице и выноскам,
 * не отрывая рук от клавиатуры.
 */
export function slashMenuSource(enabled: () => boolean) {
  return (context: CompletionContext): CompletionResult | null => {
    if (!enabled()) return null;
    const match = context.matchBefore(/(?:^|\s)\/([\p{L}\d]*)$/u);
    if (!match) return null;
    const typed = match.text.replace(/^\s*\//, "").toLowerCase();
    const options: Completion[] = ITEMS.filter(
      (item) => !typed || item.label.toLowerCase().includes(typed),
    ).map((item) => ({
      label: item.label,
      detail: item.detail,
      type: "keyword",
      apply: (view: EditorView, _completion: Completion, from: number, to: number) =>
        applyInsert(view, from, to, item.insert),
    }));
    if (!options.length) return null;
    return { from: match.from + match.text.indexOf("/"), options, filter: false };
  };
}

function applyInsert(view: EditorView, from: number, to: number, template: string): void {
  const cursor = template.indexOf("|");
  const insert = template.replace("|", "");
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + (cursor < 0 ? insert.length : cursor) },
    userEvent: "input.slash",
  });
}
