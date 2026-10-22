import { isTauri } from "@/core/fs";
import { buildAuthUrl, createPkcePair, exchangeCode, type TokenSet } from "./gdriveAuth";

export interface SignInOptions {
  clientId: string;
  clientSecret?: string;
  /** Сколько ждать подтверждения в браузере. */
  timeoutSecs?: number;
}

/**
 * Вход в Google в один клик: приложение поднимает локальный порт,
 * открывает страницу согласия и само принимает редирект с кодом.
 * Копировать ничего не нужно — как в обычных настольных приложениях.
 */
export async function signInWithGoogle(options: SignInOptions): Promise<TokenSet> {
  if (!isTauri()) {
    throw new Error("Вход в один клик доступен в приложении; в браузере используйте ручной код");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const { openUrl } = await import("@tauri-apps/plugin-opener");

  const port = await invoke<number>("oauth_start");
  const redirectUri = `http://127.0.0.1:${port}`;

  try {
    const pair = await createPkcePair();
    await openUrl(buildAuthUrl({ clientId: options.clientId, redirectUri, challenge: pair.challenge }));
    const code = await invoke<string>("oauth_wait", { timeoutSecs: options.timeoutSecs ?? 180 });
    return await exchangeCode({
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      redirectUri,
      code,
      verifier: pair.verifier,
    });
  } catch (error) {
    await invoke("oauth_cancel").catch(() => undefined);
    throw error;
  }
}
