import type { VaultFs } from "../fs/types";

export const MANIFEST_DIR = ".fleetnote";
export const MANIFEST_PATH = `${MANIFEST_DIR}/sync-manifest.json`;

export interface ManifestEntry {
  hash: string;
  mtime: number;
  /** Время последней успешной синхронизации этой записи. */
  syncedAt: number;
}

export interface SyncManifest {
  version: 1;
  updatedAt: number;
  entries: Record<string, ManifestEntry>;
}

export function emptyManifest(): SyncManifest {
  return { version: 1, updatedAt: 0, entries: {} };
}

export async function loadManifest(fs: VaultFs): Promise<SyncManifest> {
  try {
    if (!(await fs.exists(MANIFEST_PATH))) return emptyManifest();
    const parsed = JSON.parse(await fs.readText(MANIFEST_PATH)) as SyncManifest;
    if (parsed.version !== 1 || typeof parsed.entries !== "object") return emptyManifest();
    return parsed;
  } catch {
    return emptyManifest();
  }
}

export async function saveManifest(fs: VaultFs, manifest: SyncManifest): Promise<void> {
  manifest.updatedAt = Date.now();
  await fs.mkdir(MANIFEST_DIR);
  await fs.writeText(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

/** sha256 через Web Crypto — есть и в WebView на Android/iOS, и в браузере. */
export async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Имя копии при неразрешимом конфликте: `Заметка (Conflict 2026-10-21 14-32).md`. */
export function conflictPath(path: string, at = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}-${pad(at.getMinutes())}`;
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return `${path} (Conflict ${stamp})`;
  return `${path.slice(0, dot)} (Conflict ${stamp})${path.slice(dot)}`;
}
