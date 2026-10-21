export type AdapterId = "local" | "gdrive" | "webdav" | "s3";

export interface RemoteFileMeta {
  /** Путь внутри базы, относительный POSIX. */
  path: string;
  /** Время изменения в миллисекундах. */
  mtime: number;
  /** sha256 контента, если хранилище его отдаёт (S3 — ETag, остальные считают локально). */
  hash?: string;
  size?: number;
}

/**
 * Контракт, за которым спрятано любое облако.
 * Движку синхронизации всё равно, папка это, Google Drive, WebDAV или S3.
 */
export interface IStorageAdapter {
  readonly id: AdapterId;
  readonly label: string;
  connect(config: Record<string, string>): Promise<boolean>;
  listFiles(): Promise<RemoteFileMeta[]>;
  readFile(path: string): Promise<string | Uint8Array>;
  writeFile(path: string, content: string | Uint8Array, mtime: number): Promise<void>;
  deleteFile(path: string): Promise<void>;
}

export interface StorageConfig {
  adapter: AdapterId | "none";
  /** Параметры конкретного адаптера: папка, URL, бакет, токен. */
  options: Record<string, string>;
}
