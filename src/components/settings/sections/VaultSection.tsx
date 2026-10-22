import { FolderOpen, RefreshCw } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVaultStore } from "@/stores/vaultStore";
import { isTauri } from "@/core/fs";
import { describeProfile } from "@/core/vault/profiles";
import { Row, SelectField, TextField, Toggle } from "../fields";

export function VaultSection() {
  const vaultSettings = useSettingsStore((state) => state.vault);
  const set = useSettingsStore((state) => state.set);
  const vault = useVaultStore();

  return (
    <div className="flex flex-col">
      <Row label="Текущая база" hint={vault.profile ? describeProfile(vault.profile) : undefined} stacked>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted">{vault.rootLabel || "База не открыта"}</span>
          <button
            type="button"
            onClick={() => void vault.openLocalFolder()}
            className="flex touch-row items-center gap-2 rounded-xl border px-3 text-[13.5px] text-ink hairline hover:bg-hover"
          >
            <FolderOpen size={15} />
            {isTauri() ? "Открыть другую папку" : "Демо-база"}
          </button>
          <button
            type="button"
            onClick={() => void vault.rescan()}
            className="flex touch-row items-center gap-2 rounded-xl border px-3 text-[13.5px] text-ink hairline hover:bg-hover"
          >
            <RefreshCw size={15} />
            Перечитать с диска
          </button>
          <button
            type="button"
            onClick={() => vault.closeVault()}
            className="touch-row rounded-xl border px-3 text-[13.5px] text-muted hairline hover:bg-hover hover:text-ink"
          >
            Сменить базу
          </button>
        </div>
      </Row>

      <Row label="Папка вложений" hint="Куда класть вставленные картинки и файлы">
        <TextField
          value={vaultSettings.attachmentsFolder}
          onChange={(attachmentsFolder) => set("vault", { attachmentsFolder })}
          placeholder="attachments"
        />
      </Row>

      <Row label="Папка ежедневных заметок">
        <TextField
          value={vaultSettings.dailyFolder}
          onChange={(dailyFolder) => set("vault", { dailyFolder })}
          placeholder="Daily"
        />
      </Row>

      <Row label="Формат имени ежедневной заметки">
        <TextField
          value={vaultSettings.dailyFormat}
          onChange={(dailyFormat) => set("vault", { dailyFormat })}
          placeholder="YYYY-MM-DD"
        />
      </Row>

      <Row label="Где создавать новые заметки">
        <SelectField
          value={vaultSettings.newNoteLocation}
          onChange={(newNoteLocation) => set("vault", { newNoteLocation })}
          options={[
            { value: "current", label: "Рядом с открытой" },
            { value: "root", label: "В корне базы" },
          ]}
        />
      </Row>

      <Row label="Сортировка файлов">
        <SelectField
          value={vaultSettings.sortBy}
          onChange={(sortBy) => set("vault", { sortBy })}
          options={[
            { value: "name", label: "По имени" },
            { value: "modified", label: "По дате изменения" },
            { value: "created", label: "По дате создания" },
          ]}
        />
      </Row>

      <Row label="Обратный порядок">
        <Toggle value={vaultSettings.sortDesc} onChange={(sortDesc) => set("vault", { sortDesc })} />
      </Row>

      <Row label="Показывать расширения файлов">
        <Toggle
          value={vaultSettings.showFileExtensions}
          onChange={(showFileExtensions) => set("vault", { showFileExtensions })}
        />
      </Row>

      <Row label="Спрашивать перед удалением">
        <Toggle
          value={vaultSettings.confirmDelete}
          onChange={(confirmDelete) => set("vault", { confirmDelete })}
        />
      </Row>
    </div>
  );
}
