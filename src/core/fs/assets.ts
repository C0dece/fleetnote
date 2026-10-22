import type { VaultFs } from "./types";
import { extname } from "./paths";

const urlCache = new Map<string, string>();

/** Ссылка, по которой браузер или WebView покажет файл базы. */
export async function assetUrl(fs: VaultFs, path: string): Promise<string> {
  const key = `${fs.root}::${path}`;
  const cached = urlCache.get(key);
  if (cached) return cached;

  let url: string;
  if (fs.kind === "tauri") {
    // В приложении файл отдаётся протоколом asset, настроенным в tauri.conf.json
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    url = convertFileSrc(`${fs.root.replace(/[\\/]+$/, "")}/${path}`);
  } else {
    const bytes = await fs.readBinary(path);
    url = URL.createObjectURL(new Blob([bytes.slice()], { type: mimeOf(path) }));
  }
  urlCache.set(key, url);
  return url;
}

/** Сбросить ссылку после перезаписи файла, иначе покажется старая версия. */
export function invalidateAsset(fs: VaultFs, path: string): void {
  const key = `${fs.root}::${path}`;
  const url = urlCache.get(key);
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  urlCache.delete(key);
}

export type FileKind = "image" | "pdf" | "audio" | "video" | "text" | "canvas" | "other";

const IMAGE = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico"];
const AUDIO = [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"];
const VIDEO = [".mp4", ".webm", ".mov", ".mkv", ".avi"];
const TEXT = [
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".csv",
  ".log",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".css",
  ".html",
  ".xml",
  ".sh",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".sql",
  ".ini",
  ".env",
  ".gitignore",
];

/** Чем открывать файл: от этого зависит вид вкладки. */
export function fileKind(path: string): FileKind {
  const ext = extname(path);
  if (ext === ".canvas") return "canvas";
  if (IMAGE.includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if (AUDIO.includes(ext)) return "audio";
  if (VIDEO.includes(ext)) return "video";
  if (TEXT.includes(ext)) return "text";
  return "other";
}

export function mimeOf(path: string): string {
  const ext = extname(path);
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
  };
  return map[ext] ?? "application/octet-stream";
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}
