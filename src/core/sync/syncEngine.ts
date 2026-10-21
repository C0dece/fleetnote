import type { VaultFs } from "../fs/types";
import { dirname, isMarkdown, join } from "../fs/paths";
import type { IStorageAdapter, RemoteFileMeta } from "./types";
import {
  MANIFEST_DIR,
  conflictPath,
  emptyManifest,
  loadManifest,
  saveManifest,
  sha256,
  type SyncManifest,
} from "./manifest";
import { merge3 } from "./merge";

export type SyncStatus = "off" | "idle" | "syncing" | "offline" | "error";

export interface SyncState {
  status: SyncStatus;
  /** Сколько файлов ждёт отправки (в том числе накопленных офлайн). */
  pending: number;
  lastSyncAt?: number;
  message?: string;
  conflicts: string[];
  adapterLabel?: string;
}

export interface SyncReport {
  pushed: string[];
  pulled: string[];
  merged: string[];
  conflicted: string[];
  deletedLocal: string[];
  deletedRemote: string[];
}

const BASE_DIR = `${MANIFEST_DIR}/base`;
const QUEUE_KEY = "fleetnote.sync-queue.v1";
const PUSH_DEBOUNCE_MS = 1500;

/**
 * Фоновый синхронизатор. Правило номер один: редактор никогда не ждёт сеть.
 * Любая правка просто попадает в очередь, а движок разбирается с ней сам —
 * в том числе после перезапуска приложения и возврата связи.
 */
export class SyncEngine {
  private adapter: IStorageAdapter | null = null;
  private manifest: SyncManifest = emptyManifest();
  private queue = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private listeners = new Set<(state: SyncState) => void>();
  private state: SyncState = { status: "off", pending: 0, conflicts: [] };
  private onlineHandler = () => {
    if (this.adapter) void this.flush();
  };

  constructor(private fs: VaultFs) {
    this.queue = new Set(readQueue());
    this.state.pending = this.queue.size;
    if (typeof window !== "undefined") window.addEventListener("online", this.onlineHandler);
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    if (typeof window !== "undefined") window.removeEventListener("online", this.onlineHandler);
    this.listeners.clear();
  }

  onState(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): SyncState {
    return this.state;
  }

  private patch(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial, pending: partial.pending ?? this.queue.size };
    for (const listener of this.listeners) listener(this.state);
  }

  async setAdapter(adapter: IStorageAdapter | null): Promise<void> {
    this.adapter = adapter;
    this.manifest = await loadManifest(this.fs);
    this.patch({
      status: adapter ? "idle" : "off",
      adapterLabel: adapter?.label,
      message: undefined,
    });
  }

  /** Вызывается после каждого сохранения заметки. Сеть здесь не трогается. */
  notifyLocalChange(path: string): void {
    this.queue.add(path);
    writeQueue([...this.queue]);
    this.patch({});
    if (!this.adapter) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), PUSH_DEBOUNCE_MS);
  }

  notifyLocalDelete(path: string): void {
    this.queue.add(path);
    writeQueue([...this.queue]);
    if (this.adapter) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.flush(), PUSH_DEBOUNCE_MS);
    }
  }

  /** Отправить накопленную очередь. */
  async flush(): Promise<SyncReport | null> {
    if (!this.adapter || this.running || this.queue.size === 0) return null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.patch({ status: "offline", message: "Нет сети — правки ждут в очереди" });
      return null;
    }
    const paths = [...this.queue];
    return this.run(async (adapter, remote) => {
      const report = emptyReport();
      for (const path of paths) {
        await this.reconcile(adapter, path, remote.get(path), report);
        this.queue.delete(path);
        writeQueue([...this.queue]);
        this.patch({});
      }
      return report;
    });
  }

  /** Полная двусторонняя сверка: при старте, по кнопке и после возврата сети. */
  async syncAll(): Promise<SyncReport | null> {
    if (!this.adapter) return null;
    return this.run(async (adapter, remote) => {
      const report = emptyReport();
      const local = await this.localFiles();
      const paths = new Set<string>([...local, ...remote.keys(), ...this.queue]);
      for (const path of [...paths].sort()) {
        await this.reconcile(adapter, path, remote.get(path), report);
        this.queue.delete(path);
      }
      writeQueue([...this.queue]);
      return report;
    });
  }

  private async run(
    job: (adapter: IStorageAdapter, remote: Map<string, RemoteFileMeta>) => Promise<SyncReport>,
  ): Promise<SyncReport | null> {
    const adapter = this.adapter;
    if (!adapter || this.running) return null;
    this.running = true;
    this.patch({ status: "syncing", message: undefined });
    try {
      const remoteList = await adapter.listFiles();
      const remote = new Map(remoteList.map((item) => [item.path, item]));
      const report = await job(adapter, remote);
      await saveManifest(this.fs, this.manifest);
      this.patch({
        status: "idle",
        lastSyncAt: Date.now(),
        conflicts: report.conflicted,
        message: describe(report),
      });
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      this.patch({ status: offline ? "offline" : "error", message });
      return null;
    } finally {
      this.running = false;
    }
  }

  private async localFiles(): Promise<string[]> {
    const entries = await this.fs.list();
    return entries
      .filter((entry) => !entry.isDir && !entry.path.startsWith(`${MANIFEST_DIR}/`))
      .map((entry) => entry.path);
  }

  /** Решение по одному файлу: что отправить, что забрать, что слить. */
  private async reconcile(
    adapter: IStorageAdapter,
    path: string,
    remoteMeta: RemoteFileMeta | undefined,
    report: SyncReport,
  ): Promise<void> {
    if (path.startsWith(`${MANIFEST_DIR}/`)) return;
    const entry = this.manifest.entries[path];
    const localExists = await this.fs.exists(path);
    const text = isMarkdown(path);

    // 1. Файла нет в облаке.
    if (!remoteMeta) {
      if (!localExists) {
        delete this.manifest.entries[path];
        return;
      }
      const localHash = await this.hashLocal(path);
      if (entry && entry.hash === localHash) {
        // Локально не меняли, а в облаке удалили — повторяем удаление у себя.
        await this.fs.remove(path);
        await this.removeBase(path);
        delete this.manifest.entries[path];
        report.deletedLocal.push(path);
        return;
      }
      await this.push(adapter, path);
      report.pushed.push(path);
      return;
    }

    // 2. Файла нет локально.
    if (!localExists) {
      const remoteContent = await adapter.readFile(path);
      const remoteHash = await sha256(remoteContent);
      if (entry && entry.hash === remoteHash) {
        await adapter.deleteFile(path);
        await this.removeBase(path);
        delete this.manifest.entries[path];
        report.deletedRemote.push(path);
        return;
      }
      await this.writeLocal(path, remoteContent);
      await this.saveBase(path, remoteContent);
      this.manifest.entries[path] = { hash: remoteHash, mtime: remoteMeta.mtime, syncedAt: Date.now() };
      report.pulled.push(path);
      return;
    }

    // 3. Файл есть и там, и там.
    const localContent = text ? await this.fs.readText(path) : await this.fs.readBinary(path);
    const localHash = await sha256(localContent);
    const remoteContent = await adapter.readFile(path);
    const remoteHash = await sha256(remoteContent);

    if (localHash === remoteHash) {
      await this.saveBase(path, localContent);
      this.manifest.entries[path] = { hash: localHash, mtime: remoteMeta.mtime, syncedAt: Date.now() };
      return;
    }

    const localChanged = !entry || entry.hash !== localHash;
    const remoteChanged = !entry || entry.hash !== remoteHash;

    if (localChanged && !remoteChanged) {
      await this.push(adapter, path, localContent, localHash);
      report.pushed.push(path);
      return;
    }
    if (remoteChanged && !localChanged) {
      await this.writeLocal(path, remoteContent);
      await this.saveBase(path, remoteContent);
      this.manifest.entries[path] = { hash: remoteHash, mtime: remoteMeta.mtime, syncedAt: Date.now() };
      report.pulled.push(path);
      return;
    }

    // Изменили с двух сторон. Текст пробуем слить, бинарник — только копией.
    if (!text || typeof localContent !== "string" || typeof remoteContent !== "string") {
      await this.keepBothBinary(adapter, path, remoteContent, report);
      return;
    }
    const base = (await this.readBase(path)) ?? "";
    const merged = merge3(base, localContent, remoteContent);
    if (!merged.conflicted) {
      await this.fs.writeText(path, merged.text);
      await this.push(adapter, path, merged.text);
      await this.saveBase(path, merged.text);
      report.merged.push(path);
      return;
    }
    // Пересечение правок: ничего не теряем — версия из облака ложится рядом.
    const copy = conflictPath(path);
    await this.fs.writeText(copy, remoteContent);
    await this.push(adapter, copy, remoteContent);
    await this.push(adapter, path, localContent, localHash);
    report.conflicted.push(copy);
  }

  private async push(
    adapter: IStorageAdapter,
    path: string,
    content?: string | Uint8Array,
    knownHash?: string,
  ): Promise<void> {
    const body =
      content ?? (isMarkdown(path) ? await this.fs.readText(path) : await this.fs.readBinary(path));
    const hash = knownHash ?? (await sha256(body));
    const mtime =
      (await this.fs.stat(path).catch(() => ({ mtime: Date.now(), size: 0 }))).mtime || Date.now();
    await adapter.writeFile(path, body, mtime);
    await this.saveBase(path, body);
    this.manifest.entries[path] = { hash, mtime, syncedAt: Date.now() };
  }

  private async keepBothBinary(
    adapter: IStorageAdapter,
    path: string,
    remoteContent: string | Uint8Array,
    report: SyncReport,
  ): Promise<void> {
    const copy = conflictPath(path);
    await this.writeLocal(copy, remoteContent);
    await this.push(adapter, copy, remoteContent);
    await this.push(adapter, path);
    report.conflicted.push(copy);
  }

  private async writeLocal(path: string, content: string | Uint8Array): Promise<void> {
    const dir = dirname(path);
    if (dir) await this.fs.mkdir(dir);
    if (typeof content === "string") await this.fs.writeText(path, content);
    else await this.fs.writeBinary(path, content);
  }

  private async hashLocal(path: string): Promise<string> {
    const content = isMarkdown(path) ? await this.fs.readText(path) : await this.fs.readBinary(path);
    return sha256(content);
  }

  // Теневая копия последней синхронизированной версии — база для трёхстороннего слияния.
  private basePath(path: string): string {
    return join(BASE_DIR, path);
  }

  private async saveBase(path: string, content: string | Uint8Array): Promise<void> {
    if (typeof content !== "string") return; // бинарники теневой копией не дублируем
    try {
      await this.fs.mkdir(dirname(this.basePath(path)));
      await this.fs.writeText(this.basePath(path), content);
    } catch {
      /* нет места или прав — переживём, просто merge станет двухсторонним */
    }
  }

  private async readBase(path: string): Promise<string | null> {
    try {
      return (await this.fs.exists(this.basePath(path))) ? await this.fs.readText(this.basePath(path)) : null;
    } catch {
      return null;
    }
  }

  private async removeBase(path: string): Promise<void> {
    try {
      if (await this.fs.exists(this.basePath(path))) await this.fs.remove(this.basePath(path));
    } catch {
      /* не критично */
    }
  }
}

function emptyReport(): SyncReport {
  return { pushed: [], pulled: [], merged: [], conflicted: [], deletedLocal: [], deletedRemote: [] };
}

function describe(report: SyncReport): string | undefined {
  const parts: string[] = [];
  if (report.pushed.length) parts.push(`отправлено ${report.pushed.length}`);
  if (report.pulled.length) parts.push(`получено ${report.pulled.length}`);
  if (report.merged.length) parts.push(`слито ${report.merged.length}`);
  if (report.conflicted.length) parts.push(`конфликтов ${report.conflicted.length}`);
  if (report.deletedLocal.length || report.deletedRemote.length) {
    parts.push(`удалено ${report.deletedLocal.length + report.deletedRemote.length}`);
  }
  return parts.length ? parts.join(", ") : undefined;
}

function readQueue(): string[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(paths: string[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(paths));
  } catch {
    /* приватный режим браузера */
  }
}
