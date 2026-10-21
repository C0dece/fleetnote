import {
  exists as fsExists,
  mkdir as fsMkdir,
  readDir,
  readFile,
  readTextFile,
  remove as fsRemove,
  rename as fsRename,
  stat as fsStat,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { VaultEntry, VaultFs } from "./types";
import { basename, dirname, normalize } from "./paths";

/** Настоящая файловая система устройства через tauri-plugin-fs. */
export class TauriVaultFs implements VaultFs {
  readonly kind = "tauri" as const;

  constructor(readonly root: string) {}

  /** Абсолютный путь ОС для относительного пути базы. */
  private abs(path: string): string {
    const rel = normalize(path);
    const base = this.root.replace(/[\\/]+$/, "");
    return rel ? `${base}/${rel}` : base;
  }

  async list(): Promise<VaultEntry[]> {
    const out: VaultEntry[] = [];
    const walk = async (rel: string): Promise<void> => {
      const entries = await readDir(this.abs(rel));
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue; // .git, .fleetnote, .obsidian и прочее служебное
        const path = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory) {
          out.push({ path, name: entry.name, isDir: true });
          await walk(path);
        } else if (entry.isFile) {
          out.push({ path, name: entry.name, isDir: false });
        }
      }
    };
    await walk("");
    return out;
  }

  async exists(path: string): Promise<boolean> {
    return fsExists(this.abs(path));
  }

  async readText(path: string): Promise<string> {
    return readTextFile(this.abs(path));
  }

  async readBinary(path: string): Promise<Uint8Array> {
    return readFile(this.abs(path));
  }

  async writeText(path: string, content: string): Promise<void> {
    await this.ensureParent(path);
    await writeTextFile(this.abs(path), content);
  }

  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    await this.ensureParent(path);
    await writeFile(this.abs(path), data);
  }

  async mkdir(path: string): Promise<void> {
    await fsMkdir(this.abs(path), { recursive: true });
  }

  async remove(path: string): Promise<void> {
    await fsRemove(this.abs(path), { recursive: true });
  }

  async rename(from: string, to: string): Promise<void> {
    await this.ensureParent(to);
    await fsRename(this.abs(from), this.abs(to));
  }

  async stat(path: string): Promise<{ mtime: number; size: number }> {
    const info = await fsStat(this.abs(path));
    return { mtime: info.mtime ? new Date(info.mtime).getTime() : 0, size: info.size ?? 0 };
  }

  private async ensureParent(path: string): Promise<void> {
    const dir = dirname(path);
    if (dir && !(await fsExists(this.abs(dir)))) await fsMkdir(this.abs(dir), { recursive: true });
  }
}

export { basename };
