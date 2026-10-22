import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSyncStore } from "@/stores/syncStore";
import { ADAPTER_FIELDS } from "@/core/sync/adapters";
import type { AdapterId } from "@/core/sync/types";
import { GoogleAuthBlock } from "../GoogleAuthBlock";
import { hasBuiltInClient } from "@/core/sync/adapters/gdriveAuth";
import { secretsBackend } from "@/core/secrets";
import { Row, Segmented, SelectField, Slider, TextField, Toggle } from "../fields";

const ADAPTERS: Array<{ id: AdapterId | "none"; label: string }> = [
  { id: "none", label: "Без синхронизации" },
  { id: "local", label: "Папка-зеркало" },
  { id: "gdrive", label: "Google Диск" },
  { id: "webdav", label: "WebDAV" },
  { id: "s3", label: "S3 / R2 / MinIO" },
];

export function SyncSection() {
  const sync = useSettingsStore((state) => state.sync);
  const set = useSettingsStore((state) => state.set);
  const store = useSyncStore();
  const profile = useSyncStore((state) => state.profile);
  const [adapter, setAdapter] = useState<AdapterId | "none">(profile?.adapter ?? "none");
  const [options, setOptions] = useState<Record<string, string>>(profile?.options ?? {});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setAdapter(profile?.adapter ?? "none");
    setOptions(profile?.options ?? {});
  }, [profile]);

  const apply = async () => {
    setNotice(null);
    if (adapter === "none") {
      await store.disconnect();
      setNotice("Синхронизация отключена — заметки остаются на устройстве");
      return;
    }
    const ok = await store.connect(adapter, options);
    setNotice(ok ? "Подключено, синхронизация запущена" : (store.lastError ?? "Не удалось подключиться"));
  };

  return (
    <div className="flex flex-col">
      <Row label="Состояние" hint={store.status.message} stacked>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted">
            {store.status.adapterLabel ?? "Хранилище не подключено"}
            {store.status.pending > 0 ? ` · в очереди ${store.status.pending}` : ""}
          </span>
          <button
            type="button"
            onClick={() => void store.syncNow("both")}
            disabled={store.busy}
            className="flex touch-row items-center gap-2 rounded-xl border px-3 text-[13.5px] text-ink hairline hover:bg-hover disabled:opacity-50"
          >
            <RefreshCw size={15} className={store.busy ? "animate-spin" : ""} />
            Синхронизировать
          </button>
          <button
            type="button"
            onClick={() => void store.syncNow("pull")}
            disabled={store.busy}
            title="Забрать версию из хранилища, ничего не отправляя"
            className="flex touch-row items-center gap-2 rounded-xl border px-3 text-[13.5px] text-ink hairline hover:bg-hover disabled:opacity-50"
          >
            <ArrowDownToLine size={15} />
            Забрать
          </button>
          <button
            type="button"
            onClick={() => void store.syncNow("push")}
            disabled={store.busy}
            title="Отправить своё состояние в хранилище"
            className="flex touch-row items-center gap-2 rounded-xl border px-3 text-[13.5px] text-ink hairline hover:bg-hover disabled:opacity-50"
          >
            <ArrowUpFromLine size={15} />
            Отправить
          </button>
        </div>
      </Row>

      <Row label="Хранилище">
        <SelectField
          value={adapter}
          onChange={(next) => setAdapter(next)}
          options={ADAPTERS.map((item) => ({ value: item.id, label: item.label }))}
        />
      </Row>

      {adapter !== "none" && (
        <div className="flex flex-col gap-2 border-b py-3 hairline">
          {ADAPTER_FIELDS[adapter]
            .filter(
              (field) => !(adapter === "gdrive" && hasBuiltInClient() && field.key.startsWith("client")),
            )
            .map((field) => (
              <label key={field.key} className="flex flex-col gap-1 text-[12.5px] text-muted">
                {field.label}
                <TextField
                  wide
                  type={field.type === "password" ? "password" : "text"}
                  value={options[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(value) => setOptions({ ...options, [field.key]: value })}
                />
              </label>
            ))}
          {adapter === "gdrive" && <GoogleAuthBlock options={options} setOptions={setOptions} />}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={store.busy}
              className="touch-row rounded-xl bg-accent px-4 text-[14px] font-medium text-white disabled:opacity-50"
            >
              Подключить
            </button>
            {notice && <span className="text-[12.5px] text-muted">{notice}</span>}
          </div>
          {store.lastError && <p className="text-[12.5px] text-danger">{store.lastError}</p>}
          <p className="text-[12px] text-muted">
            {secretsBackend() === "system"
              ? "Пароли и токены хранятся в системном хранилище секретов."
              : secretsBackend() === "file"
                ? "Системное хранилище недоступно: секреты лежат в файле приложения с правами только для вас."
                : "Браузерная версия: секреты остаются в хранилище вкладки."}
          </p>
        </div>
      )}

      <Row label="Автоматическая синхронизация" hint="Фоновая сверка по расписанию и после правок">
        <Toggle value={sync.auto} onChange={(auto) => set("sync", { auto })} />
      </Row>

      <Row label="Интервал сверки">
        <Slider
          value={sync.intervalMin}
          min={1}
          max={60}
          unit=" мин"
          onChange={(intervalMin) => set("sync", { intervalMin })}
        />
      </Row>

      <Row label="Задержка отправки правок" hint="Сколько тишины ждать, прежде чем отправить заметку">
        <Slider
          value={sync.pushDebounceMs}
          min={500}
          max={10000}
          step={250}
          unit=" мс"
          onChange={(pushDebounceMs) => set("sync", { pushDebounceMs })}
        />
      </Row>

      <Row label="Направление по умолчанию" hint="Что делает кнопка синхронизации без уточнения">
        <Segmented
          value={sync.direction}
          onChange={(direction) => set("sync", { direction })}
          options={[
            { value: "both", label: "Обе стороны" },
            { value: "pull", label: "Только забирать" },
            { value: "push", label: "Только отправлять" },
          ]}
        />
      </Row>

      <Row
        label="Если правки пересеклись"
        hint="Слияние объединяет строки; копия сохраняет обе версии отдельными файлами"
      >
        <SelectField
          value={sync.conflict}
          onChange={(conflict) => set("sync", { conflict })}
          options={[
            { value: "merge", label: "Слить построчно" },
            { value: "copy", label: "Сохранить обе версии" },
            { value: "keep-local", label: "Оставить своё" },
            { value: "keep-remote", label: "Взять из хранилища" },
          ]}
        />
      </Row>

      <Row label="Сверять при запуске">
        <Toggle value={sync.syncOnStart} onChange={(syncOnStart) => set("sync", { syncOnStart })} />
      </Row>
    </div>
  );
}
