import type { AdapterId } from "../sync/types";

/**
 * Профиль базы: откуда брать заметки.
 * `local` — папка на диске, источник истины на устройстве.
 * `remote` — хранилище в сети: источник истины там, на устройстве лежит кэш,
 *            поэтому приложение полностью работает и без интернета.
 * `demo` — база в памяти браузера для знакомства с интерфейсом.
 */
export interface VaultProfile {
  id: string;
  name: string;
  kind: "local" | "remote" | "demo";
  /** kind=local: абсолютный путь к папке. */
  path?: string;
  /** kind=remote: какой адаптер и с какими параметрами. */
  adapter?: AdapterId;
  options?: Record<string, string>;
  /** kind=remote: папка локального кэша (заполняется при первом открытии). */
  cachePath?: string;
  lastOpened: number;
}

const LIST_KEY = "fleetnote.vaults.v2";
const LAST_KEY = "fleetnote.vaults.last";

export function listProfiles(): VaultProfile[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    const parsed = raw ? (JSON.parse(raw) as VaultProfile[]) : [];
    return parsed.sort((a, b) => b.lastOpened - a.lastOpened);
  } catch {
    return [];
  }
}

export function saveProfile(profile: VaultProfile): void {
  const all = listProfiles().filter((item) => item.id !== profile.id);
  all.unshift(profile);
  write(all.slice(0, 20));
}

export function removeProfile(id: string): void {
  write(listProfiles().filter((profile) => profile.id !== id));
  if (lastProfileId() === id) localStorage.removeItem(LAST_KEY);
}

export function rememberLast(id: string): void {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* приватный режим */
  }
}

export function lastProfileId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function lastProfile(): VaultProfile | null {
  const id = lastProfileId();
  return id ? (listProfiles().find((profile) => profile.id === id) ?? null) : null;
}

export function makeProfileId(): string {
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Человекочитаемое имя профиля по его параметрам. */
export function describeProfile(profile: VaultProfile): string {
  if (profile.kind === "local") return profile.path ?? "Папка";
  if (profile.kind === "demo") return "Демо-база в памяти";
  const options = profile.options ?? {};
  switch (profile.adapter) {
    case "webdav":
      return `${options.url ?? "WebDAV"}${options.path ? `/${options.path}` : ""}`;
    case "s3":
      return `${options.bucket ?? "S3"}${options.prefix ? `/${options.prefix}` : ""}`;
    case "gdrive":
      return `Google Диск / ${options.folder || "Fleetnote"}`;
    case "local":
      return options.path ?? "Папка-зеркало";
    default:
      return "Удалённое хранилище";
  }
}

function write(profiles: VaultProfile[]): void {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(profiles));
  } catch {
    /* приватный режим */
  }
}
