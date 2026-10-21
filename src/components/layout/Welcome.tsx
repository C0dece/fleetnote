import { FolderOpen, Sparkles } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { isTauri } from "@/core/fs";

/** Первый экран: выбрать папку (в приложении) или открыть демо-базу (в браузере). */
export function Welcome() {
  const vault = useVaultStore();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-canvas px-6 text-center pt-safe pb-safe">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Fleetnote</h1>
        <p className="mt-2 max-w-sm text-[14px] text-muted">
          Markdown-база знаний, которая живёт в вашей папке и синхронизируется через любое облако.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          type="button"
          onClick={() => void vault.pickFolder()}
          className="flex touch-row items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-medium text-white"
        >
          <FolderOpen size={17} />
          {isTauri() ? "Выбрать папку с заметками" : "Открыть демо-базу"}
        </button>
        {isTauri() && (
          <button
            type="button"
            onClick={() => void vault.openDemo()}
            className="flex touch-row items-center justify-center gap-2 rounded-xl border text-[15px] text-ink hairline"
          >
            <Sparkles size={17} />
            Посмотреть демо-базу
          </button>
        )}
      </div>

      {vault.mode === "loading" && (
        <p className="text-[13px] text-muted">
          Индексация… {vault.progress ? `${vault.progress.done}/${vault.progress.total}` : ""}
        </p>
      )}
      {vault.error && <p className="max-w-sm text-[13px] text-danger">{vault.error}</p>}
    </div>
  );
}
