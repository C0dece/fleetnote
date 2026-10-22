import { isTauri } from "./fs";

/**
 * Пароли, ключи и токены хранятся в системном хранилище секретов,
 * а не в localStorage: оттуда их может прочитать любой скрипт в WebView.
 */
let backend: "system" | "file" | "browser" = isTauri() ? "system" : "browser";

export function secretsBackend(): "system" | "file" | "browser" {
  return backend;
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (!isTauri()) {
    try {
      localStorage.setItem(`fleetnote.secret.${key}`, value);
    } catch {
      /* приватный режим */
    }
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const status = await invoke<{ backend: string }>("secret_set", { key, value });
  backend = status.backend === "file" ? "file" : "system";
}

export async function getSecret(key: string): Promise<string | null> {
  if (!isTauri()) {
    try {
      return localStorage.getItem(`fleetnote.secret.${key}`);
    } catch {
      return null;
    }
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return (await invoke<string | null>("secret_get", { key })) ?? null;
}

export async function deleteSecret(key: string): Promise<void> {
  if (!isTauri()) {
    try {
      localStorage.removeItem(`fleetnote.secret.${key}`);
    } catch {
      /* приватный режим */
    }
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("secret_delete", { key });
}

/** Поля настроек хранилищ, которые нельзя класть в обычный конфиг. */
export const SECRET_FIELDS = [
  "password",
  "secretAccessKey",
  "accessKeyId",
  "accessToken",
  "refreshToken",
  "clientSecret",
];

export function isSecretField(key: string): boolean {
  return SECRET_FIELDS.includes(key);
}

/** Разложить параметры хранилища: открытые остаются в профиле, секретные уходят в хранилище секретов. */
export async function stashSecrets(
  vaultId: string,
  options: Record<string, string>,
): Promise<Record<string, string>> {
  const open: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    if (!isSecretField(key)) {
      open[key] = value;
      continue;
    }
    if (value) await setSecret(`${vaultId}.${key}`, value);
    else await deleteSecret(`${vaultId}.${key}`);
  }
  return open;
}

/** Собрать параметры обратно перед подключением к хранилищу. */
export async function restoreSecrets(
  vaultId: string,
  options: Record<string, string>,
): Promise<Record<string, string>> {
  const full = { ...options };
  for (const key of SECRET_FIELDS) {
    const value = await getSecret(`${vaultId}.${key}`);
    if (value) full[key] = value;
  }
  return full;
}
