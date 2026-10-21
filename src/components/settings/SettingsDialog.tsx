import { useEffect, useState } from "react";
import { ExternalLink, FolderOpen, RefreshCw, X } from "lucide-react";
import { useUIStore, type ThemeName } from "@/stores/uiStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useSyncStore } from "@/stores/syncStore";
import { ADAPTER_FIELDS } from "@/core/sync/adapters";
import type { AdapterId } from "@/core/sync/types";
import { buildAuthUrl, createPkcePair, exchangeCode } from "@/core/sync/adapters/gdriveAuth";
import { isTauri } from "@/core/fs";

const THEMES: Array<{ id: ThemeName; label: string }> = [
  { id: "light", label: "Warm Paper" },
  { id: "dark", label: "Graphite" },
  { id: "amoled", label: "AMOLED" },
];

const ADAPTERS: Array<{ id: AdapterId | "none"; label: string }> = [
  { id: "none", label: "Только локально" },
  { id: "local", label: "Папка на диске" },
  { id: "gdrive", label: "Google Диск" },
  { id: "webdav", label: "WebDAV" },
  { id: "s3", label: "S3 / R2 / MinIO" },
];

export function SettingsDialog() {
  const ui = useUIStore();
  const vault = useVaultStore();
  const sync = useSyncStore();
  const [adapter, setAdapter] = useState<AdapterId | "none">(sync.config.adapter);
  const [options, setOptions] = useState<Record<string, string>>(sync.config.options);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setAdapter(sync.config.adapter);
    setOptions(sync.config.options);
  }, [sync.config]);

  if (!ui.settings) return null;

  const apply = async () => {
    setNotice(null);
    if (adapter === "none") {
      await sync.disconnect();
      setNotice("Синхронизация отключена — заметки остаются на устройстве");
      return;
    }
    const ok = await sync.connect(adapter, options);
    setNotice(ok ? "Подключено, синхронизация запущена" : (sync.lastError ?? "Не удалось подключиться"));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && ui.setSettings(false)}
    >
      <div className="flex w-full max-w-xl flex-col gap-5 border bg-panel p-4 hairline panel-shadow sm:rounded-2xl sm:p-6 pt-safe pb-safe">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-ink">Настройки</h2>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => ui.setSettings(false)}
            className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-hover"
          >
            <X size={17} />
          </button>
        </div>

        <Section title="Вид">
          <div className="flex flex-wrap gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => ui.setTheme(theme.id)}
                className={`rounded-xl border px-3 py-2 text-[13.5px] hairline ${
                  ui.theme === theme.id
                    ? "border-accent bg-accent-soft text-ink"
                    : "text-muted hover:bg-hover"
                }`}
              >
                {theme.label}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-3 text-[13.5px] text-muted">
            Кегль текста
            <input
              type="range"
              min={13}
              max={22}
              value={ui.fontSize}
              onChange={(event) => ui.setFontSize(Number(event.target.value))}
              className="flex-1 accent-[var(--fn-accent)]"
            />
            <span className="w-10 tabular-nums text-ink">{ui.fontSize}px</span>
          </label>
        </Section>

        <Section title="База заметок">
          <p className="truncate text-[13px] text-muted">{vault.rootLabel || "База не выбрана"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void vault.pickFolder()}
              className="flex touch-row items-center gap-2 rounded-xl border px-3 text-[13.5px] text-ink hairline hover:bg-hover"
            >
              <FolderOpen size={15} />
              {isTauri() ? "Выбрать папку" : "Открыть демо-базу"}
            </button>
            <button
              type="button"
              onClick={() => void vault.rescan()}
              className="flex touch-row items-center gap-2 rounded-xl border px-3 text-[13.5px] text-ink hairline hover:bg-hover"
            >
              <RefreshCw size={15} />
              Перечитать с диска
            </button>
          </div>
          {!isTauri() && (
            <p className="mt-2 text-[12.5px] text-warn">
              В браузере база живёт в памяти. Для работы с файлами запустите приложение:{" "}
              <code>npm run app:dev</code>.
            </p>
          )}
        </Section>

        <Section title="Синхронизация">
          <div className="flex flex-wrap gap-2">
            {ADAPTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAdapter(item.id)}
                className={`rounded-xl border px-3 py-2 text-[13.5px] hairline ${
                  adapter === item.id ? "border-accent bg-accent-soft text-ink" : "text-muted hover:bg-hover"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {adapter !== "none" && (
            <div className="mt-3 flex flex-col gap-2">
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
              {adapter === "gdrive" && <GoogleAuth options={options} setOptions={setOptions} />}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={sync.busy}
              className="flex touch-row items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-medium text-white disabled:opacity-50"
            >
              {sync.busy && <RefreshCw size={15} className="animate-spin" />}
              {adapter === "none" ? "Отключить" : "Подключить"}
            </button>
            {sync.status.status !== "off" && (
              <span className="text-[12.5px] text-muted">{sync.status.message ?? "Подключено"}</span>
            )}
          </div>
          {notice && <p className="mt-2 text-[12.5px] text-muted">{notice}</p>}
          {sync.lastError && <p className="mt-1 text-[12.5px] text-danger">{sync.lastError}</p>}
        </Section>
      </div>
    </div>
  );
}

/** Вход в Google по PKCE: ссылка открывается в браузере, код вставляется обратно. */
function GoogleAuth({
  options,
  setOptions,
}: {
  options: Record<string, string>;
  setOptions(next: Record<string, string>): void;
}) {
  const [verifier, setVerifier] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const redirectUri = import.meta.env.VITE_GDRIVE_REDIRECT_URI ?? "http://127.0.0.1:1421/oauth/callback";
  const clientId = options.clientId ?? import.meta.env.VITE_GDRIVE_CLIENT_ID ?? "";

  const start = async () => {
    setError(null);
    if (!clientId) {
      setError("Сначала укажите OAuth Client ID");
      return;
    }
    const pair = await createPkcePair();
    setVerifier(pair.verifier);
    const url = buildAuthUrl({ clientId, redirectUri, challenge: pair.challenge });
    if (isTauri()) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  };

  const finish = async () => {
    setError(null);
    if (!verifier) {
      setError("Сначала откройте страницу входа");
      return;
    }
    try {
      const tokens = await exchangeCode({ clientId, redirectUri, code: code.trim(), verifier });
      setOptions({
        ...options,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? "",
        expiresAt: String(tokens.expiresAt),
      });
      setCode("");
    } catch (exchangeError) {
      setError(exchangeError instanceof Error ? exchangeError.message : String(exchangeError));
    }
  };

  return (
    <div className="rounded-xl border bg-canvas p-3 hairline">
      <p className="text-[12.5px] text-muted">
        Вход выполняется по PKCE без client_secret. Откройте страницу Google, разрешите доступ и вставьте{" "}
        <code>code</code> из адресной строки редиректа.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void start()}
          className="flex touch-row items-center gap-2 rounded-lg border px-3 text-[13.5px] text-ink hairline hover:bg-hover"
        >
          <ExternalLink size={15} />
          Открыть вход Google
        </button>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Вставьте code=…"
          className="min-w-40 flex-1 rounded-lg border bg-panel px-3 py-2 text-[14px] text-ink outline-none hairline focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void finish()}
          className="touch-row rounded-lg bg-accent px-3 text-[13.5px] font-medium text-white"
        >
          Обменять код
        </button>
      </div>
      {options.accessToken && <p className="mt-2 text-[12.5px] text-ok">Токен получен</p>}
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11.5px] uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}
