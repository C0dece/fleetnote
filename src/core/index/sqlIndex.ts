import Database from "@tauri-apps/plugin-sql";
import type { NoteMeta } from "../vault/vaultManager";
import { isTauri } from "../fs";

/**
 * SQLite-кэш метаданных (tauri-plugin-sql).
 * Нужен для мгновенного старта: дерево, теги и граф показываются из кэша,
 * пока в фоне идёт полное сканирование базы.
 */
export class SqlIndex {
  private constructor(private db: Awaited<ReturnType<typeof Database.load>>) {}

  static async open(): Promise<SqlIndex | null> {
    if (!isTauri()) return null;
    try {
      const db = await Database.load("sqlite:fleetnote.db");
      const index = new SqlIndex(db);
      await index.migrate();
      return index;
    } catch (error) {
      console.warn("SQLite-кэш недоступен, работаем только в памяти", error);
      return null;
    }
  }

  private async migrate(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        vault TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL,
        tasks_total INTEGER NOT NULL DEFAULT 0,
        tasks_done INTEGER NOT NULL DEFAULT 0,
        excerpt TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (vault, path)
      )`);
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tags (
        vault TEXT NOT NULL,
        path TEXT NOT NULL,
        tag TEXT NOT NULL
      )`);
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS links (
        vault TEXT NOT NULL,
        path TEXT NOT NULL,
        target TEXT NOT NULL
      )`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags (vault, tag)`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_links_target ON links (vault, target)`);
  }

  async replaceVault(vault: string, notes: NoteMeta[]): Promise<void> {
    await this.db.execute("DELETE FROM notes WHERE vault = $1", [vault]);
    await this.db.execute("DELETE FROM tags WHERE vault = $1", [vault]);
    await this.db.execute("DELETE FROM links WHERE vault = $1", [vault]);
    for (const meta of notes) await this.upsert(vault, meta);
  }

  async upsert(vault: string, meta: NoteMeta): Promise<void> {
    await this.db.execute(
      `INSERT INTO notes (vault, path, title, mtime, size, tasks_total, tasks_done, excerpt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (vault, path) DO UPDATE SET
         title = excluded.title, mtime = excluded.mtime, size = excluded.size,
         tasks_total = excluded.tasks_total, tasks_done = excluded.tasks_done, excerpt = excluded.excerpt`,
      [vault, meta.path, meta.title, meta.mtime, meta.size, meta.tasks.total, meta.tasks.done, meta.excerpt],
    );
    await this.db.execute("DELETE FROM tags WHERE vault = $1 AND path = $2", [vault, meta.path]);
    for (const tag of meta.tags) {
      await this.db.execute("INSERT INTO tags (vault, path, tag) VALUES ($1, $2, $3)", [
        vault,
        meta.path,
        tag,
      ]);
    }
    await this.db.execute("DELETE FROM links WHERE vault = $1 AND path = $2", [vault, meta.path]);
    for (const target of meta.outgoing) {
      await this.db.execute("INSERT INTO links (vault, path, target) VALUES ($1, $2, $3)", [
        vault,
        meta.path,
        target,
      ]);
    }
  }

  async forget(vault: string, path: string): Promise<void> {
    await this.db.execute("DELETE FROM notes WHERE vault = $1 AND path = $2", [vault, path]);
    await this.db.execute("DELETE FROM tags WHERE vault = $1 AND path = $2", [vault, path]);
    await this.db.execute("DELETE FROM links WHERE vault = $1 AND path = $2", [vault, path]);
  }

  /** Быстрый старт: заголовки и даты без чтения файлов с диска. */
  async cachedNotes(
    vault: string,
  ): Promise<Array<Pick<NoteMeta, "path" | "title" | "mtime" | "size" | "excerpt">>> {
    return this.db.select(
      "SELECT path, title, mtime, size, excerpt FROM notes WHERE vault = $1 ORDER BY path",
      [vault],
    );
  }
}
