import { useEffect, useState } from "react";
import { Download, ExternalLink, FolderOpen, Paperclip } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { assetUrl, fileKind, humanSize } from "@/core/fs/assets";
import { basename, extname } from "@/core/fs/paths";
import { isTauri } from "@/core/fs";

/**
 * Вкладка для файла, который не является заметкой.
 * Картинки, PDF, звук, видео и текст показываются внутри приложения,
 * остальное открывается системным приложением.
 */
export function FileView({ path }: { path: string }) {
  const vault = useVaultStore();
  const meta = useVaultStore((state) => state.manager?.files.get(path));
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = fileKind(path);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setText(null);
    setError(null);
    void (async () => {
      const fs = vault.manager?.fs;
      if (!fs) return;
      try {
        if (kind === "text") {
          const content = await fs.readText(path);
          if (alive) setText(content);
          return;
        }
        if (kind === "image" || kind === "pdf" || kind === "audio" || kind === "video") {
          const resolved = await assetUrl(fs, path);
          if (alive) setUrl(resolved);
        }
      } catch (readError) {
        if (alive) setError(readError instanceof Error ? readError.message : String(readError));
      }
    })();
    return () => {
      alive = false;
    };
  }, [path, kind, vault.manager]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5 hairline">
        <span className="truncate text-[13px] text-ink">{basename(path)}</span>
        <span className="text-[12px] text-muted">
          {extname(path).replace(".", "").toUpperCase()}
          {meta?.size ? ` · ${humanSize(meta.size)}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {isTauri() && (
            <>
              <button
                type="button"
                onClick={() => void vault.openExternally(path)}
                className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[12.5px] text-ink hairline hover:bg-hover"
              >
                <ExternalLink size={13} /> Открыть в системе
              </button>
              <button
                type="button"
                onClick={() => void vault.revealInFolder(path)}
                className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[12.5px] text-muted hairline hover:bg-hover hover:text-ink"
              >
                <FolderOpen size={13} /> Показать в папке
              </button>
            </>
          )}
          {url && !isTauri() && (
            <a
              href={url}
              download={basename(path)}
              className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[12.5px] text-ink hairline hover:bg-hover"
            >
              <Download size={13} /> Скачать
            </a>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {error && <p className="p-4 text-[13px] text-danger">{error}</p>}

        {kind === "image" && url && (
          <div className="flex h-full items-center justify-center p-4">
            <img src={url} alt={basename(path)} className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        )}

        {kind === "pdf" && url && <object data={url} type="application/pdf" className="h-full w-full" />}

        {kind === "audio" && url && (
          <div className="flex h-full items-center justify-center p-6">
            <audio src={url} controls className="w-full max-w-md" />
          </div>
        )}

        {kind === "video" && url && (
          <div className="flex h-full items-center justify-center bg-black/30 p-4">
            <video src={url} controls className="max-h-full max-w-full rounded-lg" />
          </div>
        )}

        {kind === "text" && text !== null && (
          <pre className="fn-selectable m-0 overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-ink">
            {text}
          </pre>
        )}

        {kind === "other" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Paperclip size={28} className="text-muted" />
            <p className="text-[14px] text-ink">{basename(path)}</p>
            <p className="max-w-sm text-[12.5px] text-muted">
              Этот тип файла приложение не показывает, но он лежит в базе и синхронизируется.
              {isTauri() ? " Откройте его системным приложением кнопкой выше." : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
