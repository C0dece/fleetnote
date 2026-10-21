import MiniSearch from "minisearch";
import type { NoteMeta } from "../vault/vaultManager";

interface IndexedDoc {
  id: string;
  title: string;
  path: string;
  tags: string;
  text: string;
  /** Начало текста — из него собирается фрагмент с подсветкой в результатах. */
  snippetSource: string;
  mtime: number;
}

export interface SearchHit {
  path: string;
  title: string;
  snippet: string;
  score: number;
  terms: string[];
}

const SNIPPET_LIMIT = 2400;

/**
 * Полнотекстовый поиск в памяти (MiniSearch): нечёткий, с префиксами,
 * заголовки и теги весят больше тела заметки.
 */
export class SearchIndex {
  private mini = new MiniSearch<IndexedDoc>({
    fields: ["title", "path", "tags", "text"],
    storeFields: ["path", "title", "snippetSource"],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 3, tags: 2, path: 1.5 },
      combineWith: "AND",
    },
  });

  clear(): void {
    this.mini.removeAll();
  }

  put(meta: NoteMeta, text: string): void {
    const doc: IndexedDoc = {
      id: meta.path,
      title: meta.title,
      path: meta.path,
      tags: meta.tags.join(" "),
      text,
      snippetSource: text.slice(0, SNIPPET_LIMIT),
      mtime: meta.mtime,
    };
    if (this.mini.has(doc.id)) this.mini.discard(doc.id);
    this.mini.add(doc);
  }

  remove(path: string): void {
    if (this.mini.has(path)) this.mini.discard(path);
  }

  rename(from: string, to: string, meta: NoteMeta, text: string): void {
    this.remove(from);
    this.put({ ...meta, path: to }, text);
  }

  get size(): number {
    return this.mini.documentCount;
  }

  /** Периодическая чистка после массовых discard — иначе индекс распухает. */
  vacuum(): void {
    void this.mini.vacuum();
  }

  search(query: string, limit = 50): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const results = this.mini.search(trimmed);
    return results.slice(0, limit).map((result) => {
      const source = (result as unknown as { snippetSource?: string }).snippetSource ?? "";
      const terms = result.terms;
      return {
        path: result.id as string,
        title: (result as unknown as { title: string }).title,
        snippet: makeSnippet(source, terms),
        score: result.score,
        terms,
      };
    });
  }

  /** Подсказки для Quick Switcher (`Ctrl/Cmd + O`): только заголовок и путь. */
  suggest(query: string, limit = 20): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const results = this.mini.search(trimmed, {
      fields: ["title", "path"],
      prefix: true,
      fuzzy: 0.25,
      combineWith: "AND",
    });
    return results.slice(0, limit).map((result) => ({
      path: result.id as string,
      title: (result as unknown as { title: string }).title,
      snippet: "",
      score: result.score,
      terms: result.terms,
    }));
  }
}

function makeSnippet(source: string, terms: string[], radius = 70): string {
  if (!source) return "";
  const lower = source.toLowerCase();
  let at = -1;
  for (const term of terms) {
    at = lower.indexOf(term.toLowerCase());
    if (at >= 0) break;
  }
  if (at < 0)
    return source
      .slice(0, radius * 2)
      .replace(/\s+/g, " ")
      .trim();
  const start = Math.max(0, at - radius);
  const end = Math.min(source.length, at + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  return `${prefix}${source.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}
