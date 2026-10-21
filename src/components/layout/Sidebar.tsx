import { useState } from "react";
import { FilePlus2, FolderOpen, Hash, ListTree, Search } from "lucide-react";
import { FileTree } from "@/components/navigation/FileTree";
import { SearchPanel } from "@/components/navigation/SearchPanel";
import { TagList } from "@/components/navigation/TagList";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { IconButton } from "@/components/ui/IconButton";

type Tab = "files" | "search" | "tags";

/** Левая панель: дерево, поиск и теги — одинаковая на ПК и в мобильной шторке. */
export function Sidebar({ touch = false, initialTab = "files" }: { touch?: boolean; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const vault = useVaultStore();
  const openNote = useEditorStore((state) => state.openNote);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="@container flex items-center gap-1 overflow-hidden px-2 py-2">
        <Segment
          active={tab === "files"}
          onClick={() => setTab("files")}
          icon={<ListTree size={14} />}
          label="Файлы"
        />
        <Segment
          active={tab === "search"}
          onClick={() => setTab("search")}
          icon={<Search size={14} />}
          label="Поиск"
        />
        <Segment
          active={tab === "tags"}
          onClick={() => setTab("tags")}
          icon={<Hash size={14} />}
          label="Теги"
        />
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <IconButton
            title="Новая заметка"
            onClick={async () => {
              const path = await vault.createNote();
              if (path) await openNote(path);
            }}
          >
            <FilePlus2 size={15} />
          </IconButton>
          <IconButton title="Открыть папку с заметками" onClick={() => void vault.pickFolder()}>
            <FolderOpen size={15} />
          </IconButton>
        </div>
      </div>
      {tab === "files" && <FileTree touch={touch} />}
      {tab === "search" && <SearchPanel touch={touch} />}
      {tab === "tags" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TagList />
          <SearchPanel touch={touch} />
        </div>
      )}
    </div>
  );
}

function Segment({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick(): void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] ${
        active ? "bg-accent-soft text-ink" : "text-muted hover:bg-hover"
      }`}
    >
      {icon}
      {/* В узкой панели остаются только иконки — кнопки действий не выдавливаются за край */}
      <span className="hidden @[280px]:inline">{label}</span>
    </button>
  );
}
