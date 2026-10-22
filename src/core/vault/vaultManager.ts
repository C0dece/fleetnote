import type { VaultFs } from "../fs/types";
import {
  basename,
  dirname,
  isAttachment,
  isMarkdown,
  join,
  sanitizeName,
  stem,
  uniquePath,
} from "../fs/paths";
import { parseNote, rewriteWikiLinks, type Heading, type ParsedNote } from "./markdown";

export interface NoteMeta {
  path: string;
  /** Имя файла без расширения — по нему матчатся `[[ссылки]]`. */
  stem: string;
  title: string;
  mtime: number;
  size: number;
  tags: string[];
  /** Сырые цели исходящих ссылок (как написаны в тексте). */
  outgoing: string[];
  headings: Heading[];
  tasks: { total: number; done: number };
  excerpt: string;
}

export interface ResolvedLink {
  target: string;
  alias?: string;
  heading?: string;
  /** Путь заметки или null, если ссылка ведёт в никуда. */
  path: string | null;
}

export interface ScanOptions {
  onProgress?: (done: number, total: number) => void;
  onNote?: (meta: NoteMeta, text: string) => void;
}

export type VaultChange =
  | { type: "scanned" }
  | { type: "note-saved"; path: string }
  | { type: "created"; path: string }
  | { type: "renamed"; from: string; to: string }
  | { type: "removed"; path: string };

type Listener = (change: VaultChange) => void;

/**
 * Единый источник правды о базе: список заметок, их метаданные и граф ссылок.
 * Весь UI читает только отсюда, напрямую в файловую систему никто не ходит.
 */
export class VaultManager {
  readonly notes = new Map<string, NoteMeta>();
  readonly folders = new Set<string>();
  readonly attachments = new Set<string>();
  /** Файлы базы, которые не заметки и не вложения: холсты `.canvas` и прочее. */
  readonly otherFiles = new Set<string>();

  private byStem = new Map<string, string[]>();
  private backlinks = new Map<string, Set<string>>();
  private parsedCache = new Map<string, ParsedNote>();
  private listeners = new Set<Listener>();
  private scanOptions: ScanOptions = {};

  constructor(public fs: VaultFs) {}

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(change: VaultChange): void {
    for (const listener of this.listeners) listener(change);
  }

  /**
   * Полное сканирование базы: читает все `.md`-файлы и строит индексы.
   * `onNote` получает текст каждой заметки — чтобы поисковый индекс не перечитывал файлы повторно.
   */
  async scan(options: ScanOptions = {}): Promise<void> {
    this.scanOptions = options;
    const { onProgress, onNote } = options;
    this.notes.clear();
    this.folders.clear();
    this.attachments.clear();
    this.otherFiles.clear();
    this.parsedCache.clear();

    const entries = await this.fs.list();
    const markdown = entries.filter((e) => !e.isDir && isMarkdown(e.path));
    for (const entry of entries) {
      if (entry.isDir) this.folders.add(entry.path);
      else if (isAttachment(entry.path)) this.attachments.add(entry.path);
      else if (!isMarkdown(entry.path)) this.otherFiles.add(entry.path);
    }

    let done = 0;
    for (const entry of markdown) {
      try {
        const text = await this.fs.readText(entry.path);
        const meta = this.indexNote(entry.path, text, entry.mtime ?? Date.now(), entry.size ?? text.length);
        onNote?.(meta, text);
      } catch {
        /* нечитаемый файл просто не попадает в индекс */
      }
      done += 1;
      if (onProgress && done % 25 === 0) onProgress(done, markdown.length);
    }
    this.rebuildLinkIndex();
    onProgress?.(markdown.length, markdown.length);
    this.emit({ type: "scanned" });
  }

  private indexNote(path: string, text: string, mtime: number, size: number): NoteMeta {
    const fileStem = stem(path);
    const parsed = parseNote(fileStem, text);
    const meta: NoteMeta = {
      path,
      stem: fileStem,
      title: parsed.title,
      mtime,
      size,
      tags: parsed.tags,
      outgoing: parsed.links.map((link) => link.target),
      headings: parsed.headings,
      tasks: parsed.tasks,
      excerpt: parsed.excerpt,
    };
    this.notes.set(path, meta);
    this.parsedCache.set(path, parsed);
    let dir = dirname(path);
    while (dir) {
      this.folders.add(dir);
      dir = dirname(dir);
    }
    return meta;
  }

  private rebuildLinkIndex(): void {
    this.byStem.clear();
    this.backlinks.clear();
    for (const meta of this.notes.values()) {
      const key = meta.stem.toLowerCase();
      const list = this.byStem.get(key) ?? [];
      list.push(meta.path);
      this.byStem.set(key, list);
    }
    for (const meta of this.notes.values()) {
      for (const target of meta.outgoing) {
        const resolved = this.resolve(target, meta.path);
        if (!resolved) continue;
        const set = this.backlinks.get(resolved) ?? new Set<string>();
        set.add(meta.path);
        this.backlinks.set(resolved, set);
      }
    }
  }

  /**
   * Куда ведёт `[[ссылка]]`: сначала точный путь, затем совпадение по имени файла,
   * затем — по хвосту пути. Регистр не важен, расширение `.md` необязательно.
   */
  resolve(target: string, fromPath?: string): string | null {
    const clean = target.replace(/^\.\//, "").replace(/\.md$/i, "");
    const direct = `${clean}.md`;
    if (this.notes.has(direct)) return direct;
    if (fromPath) {
      const relative = join(dirname(fromPath), `${clean}.md`);
      if (this.notes.has(relative)) return relative;
    }
    const byStem = this.byStem.get(basename(clean).toLowerCase());
    if (byStem?.length) {
      if (byStem.length === 1 || !fromPath) return byStem[0];
      // при одноимённых заметках выбираем ближайшую к текущей папке
      const dir = dirname(fromPath);
      return [...byStem].sort((a, b) => sharedPrefix(dirname(b), dir) - sharedPrefix(dirname(a), dir))[0];
    }
    const suffix = `/${clean.toLowerCase()}.md`;
    for (const path of this.notes.keys()) if (path.toLowerCase().endsWith(suffix)) return path;
    return null;
  }

  linksFrom(path: string): ResolvedLink[] {
    const parsed = this.parsedCache.get(path);
    if (!parsed) return [];
    return parsed.links.map((link) => ({
      target: link.target,
      alias: link.alias,
      heading: link.heading,
      path: this.resolve(link.target, path),
    }));
  }

  backlinksOf(path: string): string[] {
    return [...(this.backlinks.get(path) ?? [])].sort();
  }

  /** Ссылки, которые ведут в несуществующие заметки — их можно создать одним кликом. */
  unresolvedLinks(): Array<{ target: string; from: string[] }> {
    const map = new Map<string, Set<string>>();
    for (const meta of this.notes.values()) {
      for (const target of meta.outgoing) {
        if (this.resolve(target, meta.path)) continue;
        const set = map.get(target) ?? new Set<string>();
        set.add(meta.path);
        map.set(target, set);
      }
    }
    return [...map]
      .map(([target, from]) => ({ target, from: [...from] }))
      .sort((a, b) => b.from.length - a.from.length);
  }

  allTags(): Array<{ tag: string; count: number }> {
    const counts = new Map<string, number>();
    for (const meta of this.notes.values()) {
      for (const tag of meta.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  notesWithTag(tag: string): string[] {
    const needle = tag.toLowerCase();
    return [...this.notes.values()]
      .filter((meta) =>
        meta.tags.some((t) => t.toLowerCase() === needle || t.toLowerCase().startsWith(`${needle}/`)),
      )
      .map((meta) => meta.path)
      .sort();
  }

  async read(path: string): Promise<string> {
    return this.fs.readText(path);
  }

  /** Сохранить текст заметки и переиндексировать её. */
  async save(path: string, text: string): Promise<NoteMeta> {
    await this.fs.writeText(path, text);
    const meta = this.indexNote(path, text, Date.now(), text.length);
    this.rebuildLinkIndex();
    this.emit({ type: "note-saved", path });
    return meta;
  }

  async createNote(folder = "", title = "Без названия"): Promise<string> {
    const name = sanitizeName(title) || "Без названия";
    const path = uniquePath(join(folder, `${name}.md`), (candidate) => this.notes.has(candidate));
    await this.fs.writeText(path, `# ${name}\n\n`);
    this.indexNote(path, `# ${name}\n\n`, Date.now(), name.length + 4);
    this.rebuildLinkIndex();
    this.emit({ type: "created", path });
    return path;
  }

  /** Создать заметку по «битой» ссылке `[[…]]`. */
  async createFromLink(target: string, fromPath?: string): Promise<string> {
    const folder = target.includes("/") ? dirname(target) : fromPath ? dirname(fromPath) : "";
    const name = sanitizeName(basename(target));
    return this.createNote(folder, name);
  }

  async createFolder(parent: string, name: string): Promise<string> {
    const path = uniquePath(join(parent, sanitizeName(name) || "Папка"), (candidate) =>
      this.folders.has(candidate),
    );
    await this.fs.mkdir(path);
    this.folders.add(path);
    this.emit({ type: "created", path });
    return path;
  }

  /**
   * Переименование с правкой входящих ссылок: иначе база «рассыпается»
   * — ровно та проблема, из-за которой в Obsidian держат опцию автообновления ссылок.
   */
  async rename(path: string, newName: string, options: { updateLinks?: boolean } = {}): Promise<string> {
    const isDir = this.folders.has(path) && !this.notes.has(path);
    const clean = sanitizeName(newName);
    const target = isDir
      ? join(dirname(path), clean)
      : join(dirname(path), clean.endsWith(".md") ? clean : `${clean}.md`);
    if (target === path) return path;

    await this.fs.rename(path, target);

    if (!isDir && options.updateLinks !== false) {
      const oldStem = stem(path);
      const newStem = stem(target);
      for (const source of this.backlinksOf(path)) {
        if (source === path) continue;
        const text = await this.fs.readText(source);
        const rewritten = rewriteWikiLinks(text, oldStem, newStem);
        if (rewritten !== text) {
          await this.fs.writeText(source, rewritten);
          this.indexNote(source, rewritten, Date.now(), rewritten.length);
        }
      }
    }

    await this.scan(this.scanOptions);
    this.emit({ type: "renamed", from: path, to: target });
    return target;
  }

  /**
   * Перенос файла или папки в другую папку (перетаскивание в дереве).
   * Возвращает новый путь или null, если перенос бессмысленен или невозможен.
   */
  async move(path: string, targetFolder: string): Promise<string | null> {
    const folder = targetFolder.replace(/\/+$/, "");
    if (dirname(path) === folder) return null;
    // папку нельзя положить внутрь самой себя
    if (folder === path || folder.startsWith(`${path}/`)) return null;
    const target = uniquePath(
      join(folder, basename(path)),
      (candidate) => this.notes.has(candidate) || this.folders.has(candidate),
    );
    await this.fs.rename(path, target);
    await this.scan(this.scanOptions);
    this.emit({ type: "renamed", from: path, to: target });
    return target;
  }

  async remove(path: string): Promise<void> {
    await this.fs.remove(path);
    this.notes.delete(path);
    this.folders.delete(path);
    for (const key of [...this.notes.keys()]) if (key.startsWith(`${path}/`)) this.notes.delete(key);
    for (const key of [...this.folders]) if (key.startsWith(`${path}/`)) this.folders.delete(key);
    this.rebuildLinkIndex();
    this.emit({ type: "removed", path });
  }

  /** Данные для локального графа: соседи заметки на заданной глубине. */
  localGraph(path: string, depth = 1): { nodes: string[]; edges: Array<[string, string]> } {
    const nodes = new Set<string>([path]);
    const edges = new Set<string>();
    let frontier = [path];
    for (let level = 0; level < depth; level++) {
      const next: string[] = [];
      for (const current of frontier) {
        for (const link of this.linksFrom(current)) {
          if (!link.path) continue;
          edges.add(`${current}\u0000${link.path}`);
          if (!nodes.has(link.path)) {
            nodes.add(link.path);
            next.push(link.path);
          }
        }
        for (const source of this.backlinksOf(current)) {
          edges.add(`${source}\u0000${current}`);
          if (!nodes.has(source)) {
            nodes.add(source);
            next.push(source);
          }
        }
      }
      frontier = next;
    }
    return {
      nodes: [...nodes],
      edges: [...edges].map((edge) => edge.split("\u0000") as [string, string]),
    };
  }
}

function sharedPrefix(a: string, b: string): number {
  const left = a.split("/");
  const right = b.split("/");
  let i = 0;
  while (i < left.length && i < right.length && left[i] === right[i]) i++;
  return i;
}
