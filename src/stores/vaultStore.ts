import { create } from "zustand";
import { MemoryVaultFs, TauriVaultFs, isTauri } from "@/core/fs";
import { dirname, extname, join, sanitizeName } from "@/core/fs/paths";
import type { VaultFs } from "@/core/fs/types";
import { VaultManager, type NoteMeta, type ResolvedLink } from "@/core/vault/vaultManager";
import { SearchIndex, type SearchHit } from "@/core/index/searchIndex";
import { SqlIndex } from "@/core/index/sqlIndex";
import { useSyncStore } from "./syncStore";

const LAST_VAULT_KEY = "fleetnote.last-vault";
const ATTACHMENT_DIR = "attachments";

type VaultMode = "none" | "loading" | "ready" | "error";

interface VaultState {
  manager: VaultManager | null;
  index: SearchIndex;
  sql: SqlIndex | null;
  mode: VaultMode;
  rootLabel: string;
  error?: string;
  progress: { done: number; total: number } | null;
  /** Счётчик изменений: компоненты подписываются на него вместо глубоких сравнений. */
  revision: number;
  notes: NoteMeta[];
  tags: Array<{ tag: string; count: number }>;

  openVault(fs: VaultFs, label: string): Promise<void>;
  pickFolder(): Promise<void>;
  openDemo(): Promise<void>;
  restoreLast(): Promise<void>;
  rescan(): Promise<void>;

  saveNote(path: string, text: string): Promise<void>;
  readNote(path: string): Promise<string>;
  createNote(folder?: string, title?: string): Promise<string | null>;
  createFromLink(target: string, from?: string): Promise<string | null>;
  createFolder(parent: string, name: string): Promise<void>;
  renameEntry(path: string, name: string): Promise<string | null>;
  removeEntry(path: string): Promise<void>;
  saveAttachment(file: File): Promise<string | null>;

  search(query: string): SearchHit[];
  suggest(query: string): SearchHit[];
  resolveLink(target: string, from?: string): string | null;
  linksFrom(path: string): ResolvedLink[];
  backlinks(path: string): string[];
}

export const useVaultStore = create<VaultState>((set, get) => ({
  manager: null,
  index: new SearchIndex(),
  sql: null,
  mode: "none",
  rootLabel: "",
  progress: null,
  revision: 0,
  notes: [],
  tags: [],

  async openVault(fs, label) {
    const { index } = get();
    const manager = new VaultManager(fs);
    set({ manager, mode: "loading", rootLabel: label, error: undefined, progress: { done: 0, total: 0 } });
    index.clear();
    try {
      await manager.scan({
        onProgress: (done, total) => set({ progress: { done, total } }),
        onNote: (meta, text) => index.put(meta, text),
      });
      index.vacuum();
      set({
        mode: "ready",
        progress: null,
        notes: [...manager.notes.values()],
        tags: manager.allTags(),
        revision: get().revision + 1,
      });
      if (fs.kind === "tauri") localStorage.setItem(LAST_VAULT_KEY, fs.root);

      // Кэш метаданных и синхронизация подключаются после того, как UI уже работает.
      void SqlIndex.open().then(async (sql) => {
        if (!sql) return;
        set({ sql });
        await sql.replaceVault(fs.root, [...manager.notes.values()]);
      });
      await useSyncStore.getState().attach(fs, async () => {
        await get().rescan();
        // Импорт именно динамический: editorStore статически зависит от vaultStore,
        // и обычный import замкнул бы цикл на этапе инициализации модулей.
        const { useEditorStore } = await import("./editorStore");
        await useEditorStore.getState().reloadClean();
      });
    } catch (error) {
      set({ mode: "error", error: error instanceof Error ? error.message : String(error), progress: null });
    }
  },

  async pickFolder() {
    if (!isTauri()) {
      await get().openDemo();
      return;
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({ directory: true, multiple: false, title: "Выберите папку с заметками" });
    if (typeof picked !== "string") return;
    await get().openVault(new TauriVaultFs(picked), picked);
  },

  async openDemo() {
    await get().openVault(new MemoryVaultFs(), "Демо-база (браузер)");
  },

  async restoreLast() {
    const last = localStorage.getItem(LAST_VAULT_KEY);
    if (isTauri() && last) {
      await get().openVault(new TauriVaultFs(last), last);
      return;
    }
    if (!isTauri()) await get().openDemo();
  },

  async rescan() {
    const { manager, index } = get();
    if (!manager) return;
    index.clear();
    await manager.scan({ onNote: (meta, text) => index.put(meta, text) });
    set({
      notes: [...manager.notes.values()],
      tags: manager.allTags(),
      revision: get().revision + 1,
    });
  },

  async saveNote(path, text) {
    const { manager, index, sql } = get();
    if (!manager) return;
    const meta = await manager.save(path, text);
    index.put(meta, text);
    set({ notes: [...manager.notes.values()], tags: manager.allTags(), revision: get().revision + 1 });
    void sql?.upsert(manager.fs.root, meta);
    useSyncStore.getState().notifyChange(path);
  },

  async readNote(path) {
    const { manager } = get();
    if (!manager) throw new Error("База не открыта");
    return manager.read(path);
  },

  async createNote(folder = "", title = "Без названия") {
    const { manager } = get();
    if (!manager) return null;
    const path = await manager.createNote(folder, title);
    set({ notes: [...manager.notes.values()], revision: get().revision + 1 });
    useSyncStore.getState().notifyChange(path);
    return path;
  },

  async createFromLink(target, from) {
    const { manager } = get();
    if (!manager) return null;
    const path = await manager.createFromLink(target, from);
    set({ notes: [...manager.notes.values()], revision: get().revision + 1 });
    useSyncStore.getState().notifyChange(path);
    return path;
  },

  async createFolder(parent, name) {
    const { manager } = get();
    if (!manager) return;
    await manager.createFolder(parent, name);
    set({ revision: get().revision + 1 });
  },

  async renameEntry(path, name) {
    const { manager } = get();
    if (!manager) return null;
    const target = await manager.rename(path, name);
    await get().rescan();
    useSyncStore.getState().notifyChange(target);
    useSyncStore.getState().notifyDelete(path);
    return target;
  },

  async removeEntry(path) {
    const { manager, index, sql } = get();
    if (!manager) return;
    await manager.remove(path);
    index.remove(path);
    void sql?.forget(manager.fs.root, path);
    set({ notes: [...manager.notes.values()], tags: manager.allTags(), revision: get().revision + 1 });
    useSyncStore.getState().notifyDelete(path);
  },

  async saveAttachment(file) {
    const { manager } = get();
    if (!manager) return null;
    const ext = extname(file.name) || ".png";
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const name = sanitizeName(`${file.name.replace(ext, "") || "image"} ${stamp}${ext}`);
    const path = join(ATTACHMENT_DIR, name);
    await manager.fs.mkdir(ATTACHMENT_DIR);
    await manager.fs.writeBinary(path, new Uint8Array(await file.arrayBuffer()));
    useSyncStore.getState().notifyChange(path);
    set({ revision: get().revision + 1 });
    return path;
  },

  search(query) {
    return get().index.search(query);
  },

  suggest(query) {
    const hits = get().index.suggest(query);
    if (hits.length || query.trim()) return hits;
    // пустой запрос — последние изменённые заметки
    return [...get().notes]
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 20)
      .map((meta) => ({ path: meta.path, title: meta.title, snippet: meta.excerpt, score: 0, terms: [] }));
  },

  resolveLink(target, from) {
    return get().manager?.resolve(target, from) ?? null;
  },

  linksFrom(path) {
    return get().manager?.linksFrom(path) ?? [];
  },

  backlinks(path) {
    return get().manager?.backlinksOf(path) ?? [];
  },
}));

/** Папка заметки — для создания соседних файлов. */
export function folderOf(path: string | null): string {
  return path ? dirname(path) : "";
}
