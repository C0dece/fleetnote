import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";

/** Полнотекстовый поиск по базе: заголовки, теги и тело заметок. */
export function SearchPanel({ touch = false }: { touch?: boolean }) {
  const [query, setQuery] = useState("");
  const vault = useVaultStore();
  const revision = useVaultStore((state) => state.revision);
  const openNote = useEditorStore((state) => state.openNote);
  const tagFilter = useUIStore((state) => state.tagFilter);
  const setTagFilter = useUIStore((state) => state.setTagFilter);
  const setSheet = useUIStore((state) => state.setSheet);

  const effectiveQuery = tagFilter ? `#${tagFilter}` : query;

  const hits = useMemo(() => {
    void revision;
    if (tagFilter) {
      const paths = vault.manager?.notesWithTag(tagFilter) ?? [];
      return paths.map((path) => {
        const meta = vault.manager?.notes.get(path);
        return { path, title: meta?.title ?? path, snippet: meta?.excerpt ?? "", score: 0, terms: [] };
      });
    }
    return vault.search(query);
  }, [query, tagFilter, vault, revision]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 rounded-lg border bg-canvas px-2.5 hairline focus-within:border-accent">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            value={effectiveQuery}
            onChange={(event) => {
              setTagFilter(null);
              setQuery(event.target.value);
            }}
            placeholder="Искать в базе…"
            className={`w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted ${
              touch ? "py-3" : "py-2"
            }`}
          />
          {(query || tagFilter) && (
            <button
              type="button"
              aria-label="Очистить"
              onClick={() => {
                setQuery("");
                setTagFilter(null);
              }}
              className="shrink-0 text-muted hover:text-ink"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {tagFilter && (
          <p className="mt-2 text-[12px] text-muted">
            Фильтр по тегу <span className="text-accent">#{tagFilter}</span> — {hits.length}
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        {hits.length === 0 && (query || tagFilter) && (
          <p className="px-3 py-6 text-center text-sm text-muted">Ничего не найдено</p>
        )}
        {hits.map((hit) => (
          <button
            key={hit.path}
            type="button"
            onClick={() => {
              void openNote(hit.path);
              setSheet("none");
            }}
            className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left hover:bg-hover"
          >
            <span className="w-full truncate text-[13.5px] text-ink">{hit.title}</span>
            {hit.snippet && (
              <span className="line-clamp-2 text-[12px] leading-snug text-muted">{hit.snippet}</span>
            )}
            <span className="w-full truncate text-[11px] text-muted opacity-70">{hit.path}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
