import { useMemo } from "react";
import { ArrowUpRight, CornerDownRight, FilePlus2, Link2Off } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";

/** Обратные и исходящие ссылки текущей заметки — то, из-за чего база становится графом. */
export function BacklinksPanel({ path }: { path: string | null }) {
  const vault = useVaultStore();
  const revision = useVaultStore((state) => state.revision);
  const openNote = useEditorStore((state) => state.openNote);

  const data = useMemo(() => {
    void revision;
    if (!path) return { incoming: [], outgoing: [], missing: [] };
    const incoming = vault.backlinks(path).map((source) => ({
      path: source,
      title: vault.manager?.notes.get(source)?.title ?? source,
      excerpt: vault.manager?.notes.get(source)?.excerpt ?? "",
    }));
    const links = vault.linksFrom(path);
    return {
      incoming,
      outgoing: links
        .filter((link) => link.path)
        .map((link) => ({
          path: link.path as string,
          title: vault.manager?.notes.get(link.path as string)?.title ?? link.target,
        })),
      missing: links.filter((link) => !link.path).map((link) => link.target),
    };
  }, [path, vault, revision]);

  if (!path) return <Empty>Откройте заметку</Empty>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
      <Section title={`Ссылаются сюда · ${data.incoming.length}`} icon={<CornerDownRight size={13} />}>
        {data.incoming.length === 0 && <Empty>Пока никто не ссылается</Empty>}
        {data.incoming.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => void openNote(item.path)}
            className="flex w-full flex-col items-start rounded-lg px-2 py-1.5 text-left hover:bg-hover"
          >
            <span className="w-full truncate text-[13px] text-ink">{item.title}</span>
            {item.excerpt && (
              <span className="line-clamp-2 text-[11.5px] leading-snug text-muted">{item.excerpt}</span>
            )}
          </button>
        ))}
      </Section>

      <Section title={`Ссылки из заметки · ${data.outgoing.length}`} icon={<ArrowUpRight size={13} />}>
        {data.outgoing.length === 0 && <Empty>Нет исходящих ссылок</Empty>}
        {data.outgoing.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => void openNote(item.path)}
            className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[13px] text-ink hover:bg-hover"
          >
            <span className="truncate">{item.title}</span>
          </button>
        ))}
      </Section>

      {data.missing.length > 0 && (
        <Section title={`Ведут в пустоту · ${data.missing.length}`} icon={<Link2Off size={13} />}>
          {data.missing.map((target) => (
            <button
              key={target}
              type="button"
              onClick={async () => {
                const created = await vault.createFromLink(target, path);
                if (created) await openNote(created);
              }}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-muted hover:bg-hover hover:text-ink"
            >
              <FilePlus2 size={13} />
              <span className="truncate">{target}</span>
            </button>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-1.5 px-2 text-[11px] uppercase tracking-wide text-muted">
        {icon}
        {title}
      </h3>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-3 text-[12.5px] text-muted">{children}</p>;
}
