import { create } from "zustand";
import { MemoryVaultFs, TauriVaultFs, isTauri } from "@/core/fs";
import { dirname, extname, join, sanitizeName, uniquePath } from "@/core/fs/paths";
import type { VaultFs } from "@/core/fs/types";
import { VaultManager, type NoteMeta, type ResolvedLink } from "@/core/vault/vaultManager";
import {
  describeProfile,
  listProfiles,
  makeProfileId,
  rememberLast,
  removeProfile,
  saveProfile,
  lastProfile,
  type VaultProfile,
} from "@/core/vault/profiles";
import { SearchIndex, type SearchHit } from "@/core/index/searchIndex";
import { SqlIndex } from "@/core/index/sqlIndex";
import type { AdapterId } from "@/core/sync/types";
import { settings } from "./settingsStore";
import { useSyncStore } from "./syncStore";

type VaultMode = "none" | "loading" | "ready" | "error";

interface VaultState {
  profile: VaultProfile | null;
  profiles: VaultProfile[];
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
  /** Закреплённые заметки текущей базы. */
  pins: string[];

  openProfile(profile: VaultProfile): Promise<void>;
  openLocalFolder(): Promise<void>;
  openRemote(adapter: AdapterId, options: Record<string, string>, name?: string): Promise<boolean>;
  openDemo(): Promise<void>;
  restoreLast(): Promise<void>;
  closeVault(): void;
  forgetProfile(id: string): void;
  refreshProfiles(): void;
  rescan(): Promise<void>;

  saveNote(path: string, text: string): Promise<void>;
  readNote(path: string): Promise<string>;
  createNote(folder?: string, title?: string): Promise<string | null>;
  createFromLink(target: string, from?: string): Promise<string | null>;
  createFolder(parent: string, name: string): Promise<void>;
  renameEntry(path: string, name: string): Promise<string | null>;
  moveEntry(path: string, targetFolder: string): Promise<string | null>;
  removeEntry(path: string): Promise<void>;
  saveAttachment(file: File): Promise<string | null>;
  /** Положить в базу файлы любого типа (из проводника, перетаскиванием или вставкой). */
  importFiles(files: File[], folder?: string): Promise<string[]>;
  /** Положить в базу файлы по абсолютным путям ОС. */
  importPaths(paths: string[], folder?: string): Promise<string[]>;
  /** Диалог выбора файлов на диске. */
  importFromDisk(folder?: string): Promise<string[]>;
  /** Открыть файл тем приложением, которым его открывает система. */
  openExternally(path: string): Promise<void>;
  revealInFolder(path: string): Promise<void>;
  absolutePath(path: string): string | null;
  /** Запись файла, который не является заметкой (например холста `.canvas`). */
  writeRaw(path: string, text: string): Promise<void>;
  readRaw(path: string): Promise<string>;
  createCanvas(folder?: string, title?: string): Promise<string | null>;
  togglePin(path: string): void;
  isPinned(path: string): boolean;

  search(query: string): SearchHit[];
  suggest(query: string): SearchHit[];
  resolveLink(target: string, from?: string): string | null;
  linksFrom(path: string): ResolvedLink[];
  backlinks(path: string): string[];
}

function pinsKey(profileId: string): string {
  return `fleetnote.pins.${profileId}`;
}

function loadPins(profileId: string): string[] {
  try {
    const raw = localStorage.getItem(pinsKey(profileId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Папка локального кэша для базы, которая живёт в сети. */
async function cacheDirFor(profile: VaultProfile): Promise<string> {
  if (profile.cachePath) return profile.cachePath;
  const { appLocalDataDir, join: joinPath } = await import("@tauri-apps/api/path");
  return joinPath(await appLocalDataDir(), "vaults", profile.id);
}

export const useVaultStore = create<VaultState>((set, get) => ({
  profile: null,
  profiles: listProfiles(),
  manager: null,
  index: new SearchIndex(),
  sql: null,
  mode: "none",
  rootLabel: "",
  progress: null,
  revision: 0,
  notes: [],
  tags: [],
  pins: [],

  async openProfile(profile) {
    const { index } = get();
    set({ mode: "loading", error: undefined, progress: { done: 0, total: 0 }, profile });

    try {
      let fs: VaultFs;
      let label: string;

      if (profile.kind === "demo" || !isTauri()) {
        fs = new MemoryVaultFs();
        label = profile.kind === "demo" ? "Демо-база (в памяти)" : `${profile.name} — демо-режим браузера`;
      } else if (profile.kind === "local") {
        if (!profile.path) throw new Error("У профиля не указан путь к папке");
        fs = new TauriVaultFs(profile.path);
        label = profile.path;
      } else {
        // Удалённая база: работаем с локальным кэшем, хранилище — источник истины.
        const cachePath = await cacheDirFor(profile);
        const cacheFs = new TauriVaultFs(cachePath);
        await cacheFs.mkdir("");
        fs = cacheFs;
        label = describeProfile(profile);
        profile = { ...profile, cachePath };
      }

      const manager = new VaultManager(fs);
      index.clear();
      set({ manager, rootLabel: label, pins: loadPins(profile.id) });

      await manager.scan({
        onProgress: (done, total) => set({ progress: { done, total } }),
        onNote: (meta, text) => index.put(meta, text),
      });
      index.vacuum();

      const stored: VaultProfile = { ...profile, lastOpened: Date.now() };
      saveProfile(stored);
      rememberLast(stored.id);

      set({
        mode: "ready",
        profile: stored,
        profiles: listProfiles(),
        progress: null,
        notes: [...manager.notes.values()],
        tags: manager.allTags(),
        revision: get().revision + 1,
      });

      // Кэш метаданных и синхронизация подключаются после того, как UI уже работает.
      void SqlIndex.open().then(async (sql) => {
        if (!sql) return;
        set({ sql });
        await sql.replaceVault(stored.id, [...manager.notes.values()]);
      });

      await useSyncStore.getState().attach(fs, stored, async () => {
        await get().rescan();
        const { useEditorStore } = await import("./editorStore");
        await useEditorStore.getState().reloadClean();
      });
    } catch (error) {
      set({ mode: "error", error: error instanceof Error ? error.message : String(error), progress: null });
    }
  },

  async openLocalFolder() {
    if (!isTauri()) {
      await get().openDemo();
      return;
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({ directory: true, multiple: false, title: "Выберите папку с заметками" });
    if (typeof picked !== "string") return;
    const name = picked.split(/[\\/]/).filter(Boolean).pop() ?? "Заметки";
    await get().openProfile({
      id: makeProfileId(),
      name,
      kind: "local",
      path: picked,
      lastOpened: Date.now(),
    });
  },

  /** Подключить сетевое хранилище: оно станет источником истины, рядом ляжет кэш. */
  async openRemote(adapter, options, name) {
    const profile: VaultProfile = {
      id: makeProfileId(),
      name: name?.trim() || "Сетевая база",
      kind: "remote",
      adapter,
      options,
      lastOpened: Date.now(),
    };
    await get().openProfile(profile);
    return get().mode === "ready";
  },

  async openDemo() {
    await get().openProfile({
      id: "demo",
      name: "Демо-база",
      kind: "demo",
      lastOpened: Date.now(),
    });
  },

  /** При запуске открываем последнюю базу; если её нет — показываем выбор режима. */
  async restoreLast() {
    const profile = lastProfile();
    if (profile) await get().openProfile(profile);
  },

  closeVault() {
    set({ mode: "none", manager: null, notes: [], tags: [], profile: null, rootLabel: "" });
    get().index.clear();
  },

  forgetProfile(id) {
    removeProfile(id);
    set({ profiles: listProfiles() });
  },

  refreshProfiles() {
    set({ profiles: listProfiles() });
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
    const { manager, index, sql, profile } = get();
    if (!manager) return;
    const meta = await manager.save(path, text);
    index.put(meta, text);
    set({ notes: [...manager.notes.values()], tags: manager.allTags(), revision: get().revision + 1 });
    if (profile) void sql?.upsert(profile.id, meta);
    useSyncStore.getState().notifyChange(path);
  },

  async readNote(path) {
    const { manager } = get();
    if (!manager) throw new Error("База не открыта");
    return manager.read(path);
  },

  async createNote(folder, title = "Без названия") {
    const { manager } = get();
    if (!manager) return null;
    const where = folder ?? "";
    const path = await manager.createNote(where, title);
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

  /** Перенос файла или папки в другую папку — перетаскиванием в дереве. */
  async moveEntry(path, targetFolder) {
    const { manager } = get();
    if (!manager) return null;
    const target = await manager.move(path, targetFolder);
    if (!target) return null;
    await get().rescan();
    useSyncStore.getState().notifyChange(target);
    useSyncStore.getState().notifyDelete(path);
    return target;
  },

  async removeEntry(path) {
    const { manager, index, sql, profile } = get();
    if (!manager) return;
    await manager.remove(path);
    index.remove(path);
    if (profile) void sql?.forget(profile.id, path);
    set({ notes: [...manager.notes.values()], tags: manager.allTags(), revision: get().revision + 1 });
    useSyncStore.getState().notifyDelete(path);
  },

  async saveAttachment(file) {
    const { manager } = get();
    if (!manager) return null;
    const folder = settings().vault.attachmentsFolder || "attachments";
    const ext = extname(file.name) || ".png";
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const name = sanitizeName(`${file.name.replace(ext, "") || "image"} ${stamp}${ext}`);
    const path = join(folder, name);
    await manager.fs.mkdir(folder);
    await manager.fs.writeBinary(path, new Uint8Array(await file.arrayBuffer()));
    useSyncStore.getState().notifyChange(path);
    set({ revision: get().revision + 1 });
    return path;
  },

  async writeRaw(path, text) {
    const { manager } = get();
    if (!manager) return;
    await manager.fs.writeText(path, text);
    useSyncStore.getState().notifyChange(path);
  },

  async readRaw(path) {
    const { manager } = get();
    if (!manager) throw new Error("База не открыта");
    return manager.fs.readText(path);
  },

  async createCanvas(folder = "", title = "Холст") {
    const { manager } = get();
    if (!manager) return null;
    const base = sanitizeName(title) || "Холст";
    let path = join(folder, `${base}.canvas`);
    let counter = 2;
    while (await manager.fs.exists(path)) path = join(folder, `${base} ${counter++}.canvas`);
    await manager.fs.writeText(path, JSON.stringify({ nodes: [], edges: [] }, null, 2));
    manager.files.set(path, { mtime: Date.now(), size: 0 });
    set({ revision: get().revision + 1 });
    useSyncStore.getState().notifyChange(path);
    return path;
  },

  async importFiles(files, folder) {
    const { manager } = get();
    if (!manager) return [];
    const target = folder ?? settings().vault.attachmentsFolder ?? "";
    if (target) await manager.fs.mkdir(target);
    const saved: string[] = [];
    for (const file of files) {
      const name = sanitizeName(file.name) || `файл-${Date.now()}`;
      const path = uniquePath(
        join(target, name),
        (candidate) => manager.files.has(candidate) || manager.notes.has(candidate),
      );
      await manager.fs.writeBinary(path, new Uint8Array(await file.arrayBuffer()));
      manager.files.set(path, { mtime: Date.now(), size: file.size });
      useSyncStore.getState().notifyChange(path);
      saved.push(path);
    }
    set({ revision: get().revision + 1 });
    return saved;
  },

  async importPaths(paths, folder) {
    const { manager } = get();
    if (!manager || !isTauri()) return [];
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const target = folder ?? settings().vault.attachmentsFolder ?? "";
    if (target) await manager.fs.mkdir(target);
    const saved: string[] = [];
    for (const source of paths) {
      const name = sanitizeName(source.split(/[\\/]/).pop() ?? "файл");
      const path = uniquePath(
        join(target, name),
        (candidate) => manager.files.has(candidate) || manager.notes.has(candidate),
      );
      await manager.fs.writeBinary(path, await readFile(source));
      manager.files.set(path, { mtime: Date.now(), size: 0 });
      useSyncStore.getState().notifyChange(path);
      saved.push(path);
    }
    await get().rescan();
    return saved;
  },

  async importFromDisk(folder) {
    if (!isTauri()) return [];
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({ multiple: true, title: "Выберите файлы для базы" });
    const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
    return get().importPaths(paths, folder);
  },

  absolutePath(path) {
    const { manager } = get();
    if (!manager || manager.fs.kind !== "tauri") return null;
    return `${manager.fs.root.replace(/[\\/]+$/, "")}/${path}`;
  },

  async openExternally(path) {
    const absolute = get().absolutePath(path);
    if (!absolute) return;
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(absolute);
  },

  async revealInFolder(path) {
    const absolute = get().absolutePath(path);
    if (!absolute) return;
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(absolute);
  },

  togglePin(path) {
    const { pins, profile } = get();
    const next = pins.includes(path) ? pins.filter((item) => item !== path) : [...pins, path];
    set({ pins: next });
    if (profile) {
      try {
        localStorage.setItem(pinsKey(profile.id), JSON.stringify(next));
      } catch {
        /* приватный режим */
      }
    }
  },

  isPinned(path) {
    return get().pins.includes(path);
  },

  search(query) {
    return get().index.search(query);
  },

  suggest(query) {
    const hits = get().index.suggest(query);
    if (hits.length || query.trim()) return hits;
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
