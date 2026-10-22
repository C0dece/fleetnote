import { useState } from "react";
import { Cloud, FolderOpen, HardDrive, Loader2, Server, Sparkles, X } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { isTauri } from "@/core/fs";
import { describeProfile, type VaultProfile } from "@/core/vault/profiles";
import { ADAPTER_FIELDS } from "@/core/sync/adapters";
import type { AdapterId } from "@/core/sync/types";
import { DragBar } from "./WindowChrome";

type Step = "pick" | "remote";

const REMOTE_ADAPTERS: Array<{ id: AdapterId; label: string; hint: string }> = [
  { id: "webdav", label: "WebDAV", hint: "Nextcloud, Яндекс.Диск, ownCloud, NAS" },
  { id: "s3", label: "S3 / R2 / MinIO", hint: "Любое S3-совместимое хранилище" },
  { id: "gdrive", label: "Google Диск", hint: "Папка на Диске через API" },
  { id: "local", label: "Папка-зеркало", hint: "Сетевой диск или папка облачного клиента" },
];

/**
 * Стартовый экран: выбор режима работы.
 * Главное решение принимается здесь — где лежит источник истины:
 * на этом устройстве или в сети.
 */
export function VaultChooser() {
  const vault = useVaultStore();
  const [step, setStep] = useState<Step>("pick");

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <DragBar title="Fleetnote" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 pb-safe">
          <header>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Fleetnote</h1>
            <p className="mt-1 text-[14px] text-muted">
              Markdown-база знаний. Выберите, где живут заметки — от этого зависит, что считается источником
              правды.
            </p>
          </header>

          {vault.mode === "loading" && (
            <div className="flex items-center gap-2 rounded-xl border bg-panel p-3 text-[13.5px] text-muted hairline">
              <Loader2 size={16} className="animate-spin" />
              {vault.progress
                ? `Индексация: ${vault.progress.done} из ${vault.progress.total}`
                : "Открываю базу…"}
            </div>
          )}
          {vault.error && (
            <p className="rounded-xl border border-[var(--fn-danger)] bg-panel p-3 text-[13px] text-danger">
              {vault.error}
            </p>
          )}

          {vault.profiles.length > 0 && step === "pick" && (
            <section>
              <h2 className="mb-2 text-[11.5px] uppercase tracking-wide text-muted">Недавние базы</h2>
              <div className="flex flex-col gap-1.5">
                {vault.profiles.map((profile) => (
                  <RecentRow key={profile.id} profile={profile} />
                ))}
              </div>
            </section>
          )}

          {step === "pick" ? (
            <section className="grid gap-2 sm:grid-cols-3">
              <ModeCard
                icon={<HardDrive size={20} />}
                title="Папка на устройстве"
                text="Файлы лежат локально. Облако можно подключить позже."
                onClick={() => void vault.openLocalFolder()}
              />
              <ModeCard
                icon={<Server size={20} />}
                title="Сетевое хранилище"
                text="Источник истины — сервер. На устройстве кэш, работает и без интернета."
                accent
                onClick={() => setStep("remote")}
              />
              <ModeCard
                icon={<Sparkles size={20} />}
                title="Демо-база"
                text="Несколько заметок в памяти, чтобы осмотреться."
                onClick={() => void vault.openDemo()}
              />
            </section>
          ) : (
            <RemoteForm onBack={() => setStep("pick")} />
          )}

          {!isTauri() && (
            <p className="text-[12.5px] text-warn">
              Это браузерная версия: доступа к файлам устройства нет, база живёт в памяти вкладки. Для
              настоящей работы установите приложение.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentRow({ profile }: { profile: VaultProfile }) {
  const vault = useVaultStore();
  const Icon = profile.kind === "remote" ? Cloud : profile.kind === "demo" ? Sparkles : FolderOpen;
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-panel px-3 hairline">
      <button
        type="button"
        onClick={() => void vault.openProfile(profile)}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
      >
        <Icon size={17} className="shrink-0 text-muted" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] text-ink">{profile.name}</span>
          <span className="truncate text-[12px] text-muted">{describeProfile(profile)}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Убрать из списка"
        title="Убрать из списка"
        onClick={() => vault.forgetProfile(profile.id)}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function ModeCard({
  icon,
  title,
  text,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  onClick(): void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors hairline hover:bg-hover ${
        accent ? "border-accent bg-accent-soft" : "bg-panel"
      }`}
    >
      <span className="text-accent">{icon}</span>
      <span className="text-[14.5px] font-medium text-ink">{title}</span>
      <span className="text-[12.5px] leading-snug text-muted">{text}</span>
    </button>
  );
}

function RemoteForm({ onBack }: { onBack(): void }) {
  const vault = useVaultStore();
  const [adapter, setAdapter] = useState<AdapterId>("webdav");
  const [options, setOptions] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    const ok = await vault.openRemote(adapter, options, name);
    setBusy(false);
    if (!ok) setError(useVaultStore.getState().error ?? "Не удалось подключиться");
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11.5px] uppercase tracking-wide text-muted">Сетевое хранилище</h2>
        <button type="button" onClick={onBack} className="text-[12.5px] text-muted hover:text-ink">
          Назад
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {REMOTE_ADAPTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAdapter(item.id)}
            className={`rounded-xl border p-3 text-left hairline ${
              adapter === item.id ? "border-accent bg-accent-soft" : "bg-panel hover:bg-hover"
            }`}
          >
            <span className="block text-[14px] text-ink">{item.label}</span>
            <span className="block text-[12px] text-muted">{item.hint}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-panel p-3 hairline">
        <label className="flex flex-col gap-1 text-[12.5px] text-muted">
          Название базы
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Рабочие заметки"
            className="rounded-lg border bg-canvas px-3 py-2 text-[15px] text-ink outline-none hairline focus:border-accent"
          />
        </label>
        {ADAPTER_FIELDS[adapter].map((field) => (
          <label key={field.key} className="flex flex-col gap-1 text-[12.5px] text-muted">
            {field.label}
            <input
              type={field.type === "password" ? "password" : "text"}
              value={options[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) => setOptions({ ...options, [field.key]: event.target.value })}
              className="rounded-lg border bg-canvas px-3 py-2 text-[15px] text-ink outline-none hairline focus:border-accent"
            />
          </label>
        ))}
        {adapter === "gdrive" && (
          <p className="text-[12px] text-muted">
            Для Google Диска нужен вход: подключите хранилище в настройках после открытия базы — там есть
            кнопка авторизации.
          </p>
        )}
      </div>

      {error && <p className="text-[12.5px] text-danger">{error}</p>}

      <button
        type="button"
        onClick={() => void connect()}
        disabled={busy}
        className="flex touch-row items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-medium text-white disabled:opacity-50"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        Подключить и загрузить заметки
      </button>
      <p className="text-[12px] text-muted">
        Заметки скачаются в локальный кэш. Дальше редактирование идёт мгновенно, а изменения уходят в
        хранилище фоном — и накапливаются в очереди, если сети нет.
      </p>
    </section>
  );
}
