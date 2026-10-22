import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, LogIn } from "lucide-react";
import { isTauri } from "@/core/fs";
import { signInWithGoogle } from "@/core/sync/adapters/googleSignIn";
import {
  BUILT_IN_CLIENT,
  buildAuthUrl,
  createPkcePair,
  exchangeCode,
  hasBuiltInClient,
} from "@/core/sync/adapters/gdriveAuth";
import { TextField } from "./fields";

const CONSOLE_URL = "https://console.cloud.google.com/apis/credentials";

const STEPS = [
  "Откройте консоль Google Cloud и создайте проект (или выберите существующий).",
  "В разделе «APIs & Services → Library» включите Google Drive API.",
  "В «Credentials» нажмите «Create credentials → OAuth client ID» и выберите тип «Desktop app».",
  "Скопируйте сюда Client ID и Client secret, которые покажет консоль.",
  "Там же в «Audience» добавьте себя в Test users — или переведите приложение в Production, иначе доступ придётся продлевать раз в неделю.",
];

/**
 * Вход в Google. В приложении — одной кнопкой: открывается браузер,
 * приложение само принимает ответ на локальный порт.
 * В браузерной версии остаётся запасной путь с вставкой кода.
 */
export function GoogleAuthBlock({
  options,
  setOptions,
}: {
  options: Record<string, string>;
  setOptions(next: Record<string, string>): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [manual, setManual] = useState<{ verifier: string; redirectUri: string } | null>(null);
  const [code, setCode] = useState("");

  // Ключ из сборки важнее введённого вручную: тогда пользователю ничего заполнять не нужно
  const clientId = BUILT_IN_CLIENT.id || (options.clientId ?? "");
  const clientSecret = BUILT_IN_CLIENT.secret || options.clientSecret || undefined;
  const builtIn = hasBuiltInClient();
  const signedIn = Boolean(options.accessToken);

  const saveTokens = (tokens: { accessToken: string; refreshToken?: string; expiresAt: number }) => {
    setOptions({
      ...options,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? options.refreshToken ?? "",
      expiresAt: String(tokens.expiresAt),
    });
  };

  const signIn = async () => {
    setError(null);
    if (!clientId) {
      setError("Сначала укажите Client ID — как его получить, написано ниже");
      setHelp(true);
      return;
    }
    setBusy(true);
    try {
      if (isTauri()) {
        saveTokens(await signInWithGoogle({ clientId, clientSecret }));
      } else {
        // В браузере нет локального порта — открываем страницу и ждём код
        const pair = await createPkcePair();
        const redirectUri = "http://127.0.0.1:1421";
        setManual({ verifier: pair.verifier, redirectUri });
        window.open(buildAuthUrl({ clientId, redirectUri, challenge: pair.challenge }), "_blank", "noopener");
      }
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : String(signInError));
    } finally {
      setBusy(false);
    }
  };

  const finishManual = async () => {
    if (!manual) return;
    setBusy(true);
    setError(null);
    try {
      saveTokens(
        await exchangeCode({
          clientId,
          clientSecret,
          redirectUri: manual.redirectUri,
          code: code.trim(),
          verifier: manual.verifier,
        }),
      );
      setManual(null);
      setCode("");
    } catch (exchangeError) {
      setError(exchangeError instanceof Error ? exchangeError.message : String(exchangeError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-canvas p-3 hairline">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={busy}
          className="flex touch-row items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
          {signedIn ? "Войти заново" : "Войти через Google"}
        </button>
        {signedIn && (
          <span className="flex items-center gap-1 text-[12.5px] text-ok">
            <CheckCircle2 size={14} /> Доступ выдан
          </span>
        )}
        {!builtIn && (
          <button
            type="button"
            onClick={() => setHelp((value) => !value)}
            className="ml-auto text-[12.5px] text-muted hover:text-ink"
          >
            {help ? "Скрыть инструкцию" : "Где взять Client ID?"}
          </button>
        )}
      </div>

      {builtIn && !signedIn && (
        <p className="text-[12.5px] text-muted">
          Ключ приложения уже встроен в сборку — просто нажмите «Войти через Google».
        </p>
      )}

      {busy && isTauri() && (
        <p className="text-[12.5px] text-muted">
          Открылся браузер — подтвердите доступ. Приложение само поймает ответ, копировать ничего не нужно.
        </p>
      )}

      {manual && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-muted">
            Браузерная версия: вставьте значение <code>code=…</code> из адресной строки.
          </span>
          <TextField value={code} onChange={setCode} placeholder="4/0Ab…" />
          <button
            type="button"
            onClick={() => void finishManual()}
            className="touch-row rounded-lg bg-accent px-3 text-[13.5px] font-medium text-white"
          >
            Готово
          </button>
        </div>
      )}

      {help && !builtIn && (
        <div className="rounded-lg border bg-panel p-3 hairline">
          <ol className="flex list-decimal flex-col gap-1 pl-4 text-[12.5px] leading-snug text-muted">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <button
            type="button"
            onClick={async () => {
              if (isTauri()) {
                const { openUrl } = await import("@tauri-apps/plugin-opener");
                await openUrl(CONSOLE_URL);
              } else {
                window.open(CONSOLE_URL, "_blank", "noopener");
              }
            }}
            className="mt-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] text-ink hairline hover:bg-hover"
          >
            <ExternalLink size={13} /> Открыть консоль Google Cloud
          </button>
          <p className="mt-2 text-[12px] text-muted">
            Это нужно один раз: у приложения нет общего серверного ключа, поэтому доступ к вашему Диску выдаёт
            ваш собственный OAuth-клиент. Токены хранятся в системном хранилище секретов.
          </p>
        </div>
      )}

      {error && <p className="text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
