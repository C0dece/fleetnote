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
import type { ConflictPolicy, SyncDirection } from "@/stores/settingsStore";

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

export interface SyncOptions {
  /** `both` — сверка в обе стороны, `push` — только отправить, `pull` — только забрать. */
  direction?: SyncDirection;
  conflict?: ConflictPolicy;
}

const BASE_DIR = `${MANIFEST_DIR}/base`;
const QUEUE_KEY = "fleetnote.sync-queue.v1";
const DEFAULT_PUSH_DEBOUNCE_MS = 1500;

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
  private pushDebounceMs = DEFAULT_PUSH_DEBOUNCE_MS;
  private defaults: Required<SyncOptions> = { direction: "both", conflict: "merge" };
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

  /** Значения из настроек: задержка отправки, направление и политика конфликтов по умолчанию. */
  configure(options: {
    pushDebounceMs?: number;
    direction?: SyncDirection;
    conflict?: ConflictPolicy;
  }): void {
    if (options.pushDebounceMs) this.pushDebounceMs = options.pushDebounceMs;
    if (options.direction) this.defaults.direction = options.direction;
    if (options.conflict) this.defaults.conflict = options.conflict;
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
    this.timer = setTimeout(() => void this.flush(), this.pushDebounceMs);
  }

  notifyLocalDelete(path: string): void {
    this.queue.add(path);
    writeQueue([...this.queue]);
    if (this.adapter) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.flush(), this.pushDebounceMs);
    }
  }

  /** Отправить накопленную очередь. */
  async flush(options: SyncOptions = {}): Promise<SyncReport | null> {
    if (!this.adapter || this.running || this.queue.size === 0) return null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.patch({ status: "offline", message: "Нет сети — правки ждут в очереди" });
      return null;
    }
    const paths = [...this.queue];
    return this.run(async (adapter, remote) => {
      const report = emptyReport();
      for (const path of paths) {
        await this.reconcile(adapter, path, remote.get(path), report, this.resolve(options));
        this.queue.delete(path);
        writeQueue([...this.queue]);
        this.patch({});
      }
      return report;
    });
  }

  /** Полная сверка: при старте, по кнопке и после возврата сети. */
  async syncAll(options: SyncOptions = {}): Promise<SyncReport | null> {
    if (!this.adapter) return null;
    const resolved = this.resolve(options);
    return this.run(async (adapter, remote) => {
      const report = emptyReport();
      const local = await this.localFiles();
      const paths = new Set<string>([...local, ...remote.keys(), ...this.queue]);
      for (const path of [...paths].sort()) {
        await this.reconcile(adapter, path, remote.get(path), report, resolved);
        this.queue.delete(path);
      }
      writeQueue([...this.queue]);
      return report;
    });
  }

  /** Забрать состояние хранилища на устройство, ничего не отправляя. */
  async pull(): Promise<SyncReport | null> {
    return this.syncAll({ direction: "pull" });
  }

  /** Отправить локальное состояние в хранилище, ничего не забирая. */
  async push(): Promise<SyncReport | null> {
    return this.syncAll({ direction: "push" });
  }

  private resolve(options: SyncOptions): Required<SyncOptions> {
    return {
      direction: options.direction ?? this.defaults.direction,
      conflict: options.conflict ?? this.defaults.conflict,
    };
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
    options: Required<SyncOptions>,
  ): Promise<void> {
    if (path.startsWith(`${MANIFEST_DIR}/`)) return;
    const entry = this.manifest.entries[path];
    const localExists = await this.fs.exists(path);
    const text = isMarkdown(path);
    const { direction } = options;

    // 1. Файла нет в хранилище.
    if (!remoteMeta) {
      if (!localExists) {
        delete this.manifest.entries[path];
        return;
      }
      if (direction === "pull") return; // забираем только чужое, своё не трогаем
      const localHash = await this.hashLocal(path);
      if (direction === "both" && entry && entry.hash === localHash) {
        // Локально не меняли, а в хранилище удалили — повторяем удаление у себя.
        await this.fs.remove(path);
        await this.removeBase(path);
        delete this.manifest.entries[path];
        report.deletedLocal.push(path);
        return;
      }
      await this.pushFile(adapter, path);
      report.pushed.push(path);
      return;
    }

    // 2. Файла нет на устройстве.
    if (!localExists) {
      if (direction === "push") {
        if (entry) {
          await adapter.deleteFile(path);
          await this.removeBase(path);
          delete this.manifest.entries[path];
          report.deletedRemote.push(path);
        }
        return;
      }
      const remoteContent = await adapter.readFile(path);
      const remoteHash = await sha256(remoteContent);
      if (direction === "both" && entry && entry.hash === remoteHash) {
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

    if (direction === "push") {
      await this.pushFile(adapter, path, localContent, localHash);
      report.pushed.push(path);
      return;
    }
    if (direction === "pull") {
      await this.writeLocal(path, remoteContent);
      await this.saveBase(path, remoteContent);
      this.manifest.entries[path] = { hash: remoteHash, mtime: remoteMeta.mtime, syncedAt: Date.now() };
      report.pulled.push(path);
      return;
    }

    const localChanged = !entry || entry.hash !== localHash;
    const remoteChanged = !entry || entry.hash !== remoteHash;

    if (localChanged && !remoteChanged) {
      await this.pushFile(adapter, path, localContent, localHash);
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

    // Изменили с двух сторон — дальше решает политика конфликтов.
    await this.resolveConflict(
      adapter,
      path,
      { localContent, localHash, remoteContent, remoteMeta },
      report,
      options,
    );
  }

  private async resolveConflict(
    adapter: IStorageAdapter,
    path: string,
    data: {
      localContent: string | Uint8Array;
      localHash: string;
      remoteContent: string | Uint8Array;
      remoteMeta: RemoteFileMeta;
    },
    report: SyncReport,
    options: Required<SyncOptions>,
  ): Promise<void> {
    const { localContent, localHash, remoteContent, remoteMeta } = data;
    const mergeable =
      options.conflict === "merge" && typeof localContent === "string" && typeof remoteContent === "string";

    if (options.conflict === "keep-local") {
      await this.pushFile(adapter, path, localContent, localHash);
      report.pushed.push(path);
      return;
    }
    if (options.conflict === "keep-remote") {
      await this.writeLocal(path, remoteContent);
      await this.saveBase(path, remoteContent);
      this.manifest.entries[path] = {
        hash: await sha256(remoteContent),
        mtime: remoteMeta.mtime,
        syncedAt: Date.now(),
      };
      report.pulled.push(path);
      return;
    }

    if (mergeable) {
      const base = (await this.readBase(path)) ?? "";
      const merged = merge3(base, localContent as string, remoteContent as string);
      if (!merged.conflicted) {
        await this.fs.writeText(path, merged.text);
        await this.pushFile(adapter, path, merged.text);
        await this.saveBase(path, merged.text);
        report.merged.push(path);
        return;
      }
    }

    // Ничего не теряем: версия из хранилища ложится рядом отдельным файлом.
    const copy = conflictPath(path);
    await this.writeLocal(copy, remoteContent);
    await this.pushFile(adapter, copy, remoteContent);
    await this.pushFile(adapter, path, localContent, localHash);
    report.conflicted.push(copy);
  }

  private async pushFile(
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
