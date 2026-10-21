import type { IStorageAdapter, RemoteFileMeta } from "../types";
import type { VaultFs } from "../../fs/types";
import { MemoryVaultFs, TauriVaultFs, isTauri } from "../../fs";
import { isAttachment, isMarkdown } from "../../fs/paths";

/**
 * Папка на диске как «облако»: Google Drive Desktop, Syncthing, iCloud или NAS,
 * смонтированные в ОС. Самый надёжный вариант на ПК.
 */
export class LocalFolderAdapter implements IStorageAdapter {
  readonly id = "local" as const;
  readonly label = "Локальная папка";
  private fs: VaultFs | null = null;

  async connect(config: Record<string, string>): Promise<boolean> {
    const path = config.path?.trim();
    if (!path) throw new Error("Укажите путь к папке синхронизации");
    this.fs = isTauri() ? new TauriVaultFs(path) : new MemoryVaultFs(false);
    await this.fs.list(); // проверяем, что папка читается
    return true;
  }

  private require(): VaultFs {
    if (!this.fs) throw new Error("Адаптер не подключён");
    return this.fs;
  }

  async listFiles(): Promise<RemoteFileMeta[]> {
    const fs = this.require();
    const entries = await fs.list();
    const out: RemoteFileMeta[] = [];
    for (const entry of entries) {
      if (entry.isDir || !(isMarkdown(entry.path) || isAttachment(entry.path))) continue;
      const stat = entry.mtime ? { mtime: entry.mtime, size: entry.size ?? 0 } : await fs.stat(entry.path);
      out.push({ path: entry.path, mtime: stat.mtime, size: stat.size });
    }
    return out;
  }

  async readFile(path: string): Promise<string | Uint8Array> {
    const fs = this.require();
    return isMarkdown(path) ? fs.readText(path) : fs.readBinary(path);
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    const fs = this.require();
    if (typeof content === "string") await fs.writeText(path, content);
    else await fs.writeBinary(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    await this.require().remove(path);
  }
}
