import type { VaultEntry, VaultFs } from "./types";
import { basename, dirname, normalize } from "./paths";
import { DEMO_VAULT } from "./demoVault";

interface MemoryFile {
  content: string | Uint8Array;
  mtime: number;
}

const STORAGE_KEY = "fleetnote.memory-vault.v1";

/**
 * Хранилище в памяти с зеркалом в localStorage.
 * Нужно для `npm run dev` в обычном браузере (без Tauri): интерфейс, редактор,
 * поиск и граф работают полностью, только файлы лежат не на диске.
 */
export class MemoryVaultFs implements VaultFs {
  readonly kind = "memory" as const;
  readonly root = "(demo vault in browser)";

  private files = new Map<string, MemoryFile>();
  private dirs = new Set<string>();

  constructor(seed = true) {
    if (!this.restore() && seed) {
      for (const [path, content] of Object.entries(DEMO_VAULT)) {
        this.files.set(normalize(path), { content, mtime: Date.now() });
        this.touchDirs(normalize(path));
      }
      this.persist();
    }
  }

  private touchDirs(path: string): void {
    let dir = dirname(path);
    while (dir) {
      this.dirs.add(dir);
      dir = dirname(dir);
    }
  }

  private restore(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        files: Record<string, { content: string; mtime: number }>;
        dirs: string[];
      };
      for (const [path, file] of Object.entries(parsed.files)) {
        this.files.set(path, { content: file.content, mtime: file.mtime });
      }
      for (const dir of parsed.dirs) this.dirs.add(dir);
      return this.files.size > 0;
    } catch {
      return false;
    }
  }

  private persist(): void {
    try {
      const files: Record<string, { content: string; mtime: number }> = {};
      for (const [path, file] of this.files) {
        if (typeof file.content === "string") files[path] = { content: file.content, mtime: file.mtime };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, dirs: [...this.dirs] }));
    } catch {
      /* квота браузера — не критично для dev-режима */
    }
  }

  async list(): Promise<VaultEntry[]> {
    const entries: VaultEntry[] = [];
    for (const dir of this.dirs) entries.push({ path: dir, name: basename(dir), isDir: true });
    for (const [path, file] of this.files) {
      entries.push({
        path,
        name: basename(path),
        isDir: false,
        mtime: file.mtime,
        size: typeof file.content === "string" ? file.content.length : file.content.byteLength,
      });
    }
    return entries;
  }

  async exists(path: string): Promise<boolean> {
    const p = normalize(path);
    return this.files.has(p) || this.dirs.has(p);
  }

  async readText(path: string): Promise<string> {
    const file = this.files.get(normalize(path));
    if (!file) throw new Error(`Файл не найден: ${path}`);
    return typeof file.content === "string" ? file.content : new TextDecoder().decode(file.content);
  }

  async readBinary(path: string): Promise<Uint8Array> {
    const file = this.files.get(normalize(path));
    if (!file) throw new Error(`Файл не найден: ${path}`);
    return typeof file.content === "string" ? new TextEncoder().encode(file.content) : file.content;
  }

  async writeText(path: string, content: string): Promise<void> {
    const p = normalize(path);
    this.files.set(p, { content, mtime: Date.now() });
    this.touchDirs(p);
    this.persist();
  }

  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    const p = normalize(path);
    this.files.set(p, { content: data, mtime: Date.now() });
    this.touchDirs(p);
    this.persist();
  }

  async mkdir(path: string): Promise<void> {
    const p = normalize(path);
    this.dirs.add(p);
    this.touchDirs(p);
    this.persist();
  }

  async remove(path: string): Promise<void> {
    const p = normalize(path);
    this.files.delete(p);
    this.dirs.delete(p);
    for (const key of [...this.files.keys()]) if (key.startsWith(`${p}/`)) this.files.delete(key);
    for (const key of [...this.dirs]) if (key.startsWith(`${p}/`)) this.dirs.delete(key);
    this.persist();
  }

  async rename(from: string, to: string): Promise<void> {
    const a = normalize(from);
    const b = normalize(to);
    const file = this.files.get(a);
    if (file) {
      this.files.delete(a);
      this.files.set(b, { ...file, mtime: Date.now() });
      this.touchDirs(b);
    } else if (this.dirs.has(a)) {
      this.dirs.delete(a);
      this.dirs.add(b);
      for (const key of [...this.files.keys()]) {
        if (key.startsWith(`${a}/`)) {
          const moved = this.files.get(key)!;
          this.files.delete(key);
          this.files.set(b + key.slice(a.length), moved);
        }
      }
    }
    this.persist();
  }

  async stat(path: string): Promise<{ mtime: number; size: number }> {
    const file = this.files.get(normalize(path));
    if (!file) throw new Error(`Файл не найден: ${path}`);
    return {
      mtime: file.mtime,
      size: typeof file.content === "string" ? file.content.length : file.content.byteLength,
    };
  }
}
