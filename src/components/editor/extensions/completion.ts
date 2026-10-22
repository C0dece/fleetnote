import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { slashMenuSource } from "./slashMenu";

export interface CompletionProviders {
  /** Заметки для подсказок после `[[`. */
  notes: () => Array<{ title: string; path: string }>;
  /** Теги для подсказок после `#`. */
  tags: () => Array<{ tag: string; count: number }>;
  /** Включено ли меню вставки по «/». */
  slashMenu: () => boolean;
}

/** Автодополнение `[[ссылок]]` и `#тегов` прямо во время ввода. */
export function fleetnoteCompletion(providers: CompletionProviders) {
  const wikiLinks = (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[([^\]\n]*)$/);
    if (!match) return null;
    const typed = match.text.slice(2).toLowerCase();
    const options = providers
      .notes()
      .filter(
        (note) =>
          !typed || note.title.toLowerCase().includes(typed) || note.path.toLowerCase().includes(typed),
      )
      .slice(0, 50)
      .map((note) => ({
        label: note.title,
        detail: note.path,
        apply: `${note.title}]]`,
        type: "text",
      }));
    if (!options.length) return null;
    return { from: match.from + 2, options, filter: false };
  };

  const tags = (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/(?:^|\s)#([\p{L}\p{N}_/-]*)$/u);
    if (!match) return null;
    const typed = match.text.replace(/^\s*#/, "").toLowerCase();
    const options = providers
      .tags()
      .filter((item) => !typed || item.tag.toLowerCase().startsWith(typed))
      .slice(0, 50)
      .map((item) => ({ label: item.tag, detail: `${item.count}`, type: "keyword" }));
    if (!options.length) return null;
    return { from: match.from + match.text.indexOf("#") + 1, options, filter: false };
  };

  return autocompletion({
    override: [wikiLinks, tags, slashMenuSource(providers.slashMenu)],
    activateOnTyping: true,
    icons: false,
  });
}
