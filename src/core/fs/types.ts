/** Запись в хранилище. `path` — всегда относительный POSIX-путь внутри базы, без ведущего слэша. */
export interface VaultEntry {
  path: string;
  name: string;
  isDir: boolean;
  mtime?: number;
  size?: number;
}

/**
 * Единственный способ, которым приложение трогает файлы базы.
 * Реализации: TauriVaultFs (настоящая ФС устройства) и MemoryVaultFs (браузерный dev-режим).
 */
export interface VaultFs {
  readonly kind: "tauri" | "memory";
  /** Абсолютный путь к корню базы — только для отображения в UI. */
  readonly root: string;
  /** Рекурсивный список файлов и папок базы. */
  list(): Promise<VaultEntry[]>;
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  readBinary(path: string): Promise<Uint8Array>;
  writeText(path: string, content: string): Promise<void>;
  writeBinary(path: string, data: Uint8Array): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  stat(path: string): Promise<{ mtime: number; size: number }>;
}
