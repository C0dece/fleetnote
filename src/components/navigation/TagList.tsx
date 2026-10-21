import { Hash } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";

export function TagList() {
  const tags = useVaultStore((state) => state.tags);
  const tagFilter = useUIStore((state) => state.tagFilter);
  const setTagFilter = useUIStore((state) => state.setTagFilter);

  if (!tags.length)
    return <p className="px-3 py-4 text-[12.5px] text-muted">Теги появятся, когда вы их поставите</p>;

  return (
    <div className="flex flex-wrap gap-1.5 px-2 pb-3">
      {tags.map(({ tag, count }) => (
        <button
          key={tag}
          type="button"
          onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
          className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[12px] hairline ${
            tagFilter === tag ? "bg-accent text-white" : "bg-panel-2 text-muted hover:text-ink"
          }`}
        >
          <Hash size={11} />
          {tag}
          <span className="opacity-60">{count}</span>
        </button>
      ))}
    </div>
  );
}
