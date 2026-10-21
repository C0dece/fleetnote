import { createClient, type FileStat, type WebDAVClient } from "webdav";
import type { IStorageAdapter, RemoteFileMeta } from "../types";
import { isAttachment, isMarkdown, normalize } from "../../fs/paths";

/** Nextcloud, Яндекс.Диск, ownCloud, домашний NAS — всё это WebDAV. */
export class WebDavAdapter implements IStorageAdapter {
  readonly id = "webdav" as const;
  readonly label = "WebDAV";
  private client: WebDAVClient | null = null;
  private base = "/";

  async connect(config: Record<string, string>): Promise<boolean> {
    const url = config.url?.trim();
    if (!url) throw new Error("Укажите адрес WebDAV-сервера");
    this.client = createClient(url, {
      username: config.username ?? "",
      password: config.password ?? "",
    });
    this.base = `/${normalize(config.path ?? "")}`;
    if (this.base !== "/" && !(await this.client.exists(this.base))) {
      await this.client.createDirectory(this.base, { recursive: true });
    }
    return true;
  }

  private require(): WebDAVClient {
    if (!this.client) throw new Error("Адаптер не подключён");
    return this.client;
  }

  private remote(path: string): string {
    return this.base === "/" ? `/${normalize(path)}` : `${this.base}/${normalize(path)}`;
  }

  async listFiles(): Promise<RemoteFileMeta[]> {
    const contents = (await this.require().getDirectoryContents(this.base, { deep: true })) as FileStat[];
    return contents
      .filter((item) => item.type === "file")
      .map((item) => {
        const path = normalize(decodeURIComponent(item.filename).replace(this.base, ""));
        return {
          path,
          mtime: item.lastmod ? new Date(item.lastmod).getTime() : 0,
          size: item.size,
        };
      })
      .filter((item) => isMarkdown(item.path) || isAttachment(item.path));
  }

  async readFile(path: string): Promise<string | Uint8Array> {
    const client = this.require();
    if (isMarkdown(path)) {
      return (await client.getFileContents(this.remote(path), { format: "text" })) as string;
    }
    const buffer = (await client.getFileContents(this.remote(path), { format: "binary" })) as ArrayBuffer;
    return new Uint8Array(buffer);
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    const client = this.require();
    const dir = this.remote(path).split("/").slice(0, -1).join("/");
    if (dir && !(await client.exists(dir))) await client.createDirectory(dir, { recursive: true });
    await client.putFileContents(this.remote(path), typeof content === "string" ? content : content.slice(), {
      overwrite: true,
    });
  }

  async deleteFile(path: string): Promise<void> {
    const client = this.require();
    if (await client.exists(this.remote(path))) await client.deleteFile(this.remote(path));
  }
}
