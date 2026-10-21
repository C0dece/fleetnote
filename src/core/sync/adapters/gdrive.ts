import type { IStorageAdapter, RemoteFileMeta } from "../types";
import { dirname, isMarkdown, join } from "../../fs/paths";
import { refreshToken, type TokenSet } from "./gdriveAuth";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

/**
 * Прямая работа с Google Drive REST API v3.
 * Критично для смартфонов: там Диск нельзя смонтировать как папку ОС.
 */
export class GoogleDriveAdapter implements IStorageAdapter {
  readonly id = "gdrive" as const;
  readonly label = "Google Диск";

  private tokens: TokenSet | null = null;
  private clientId = "";
  private clientSecret?: string;
  private rootId = "";
  /** path внутри базы → id файла на Диске. */
  private idByPath = new Map<string, string>();
  private folderIdByPath = new Map<string, string>();

  async connect(config: Record<string, string>): Promise<boolean> {
    if (!config.accessToken) throw new Error("Нет токена Google: пройдите авторизацию в настройках");
    this.clientId = config.clientId ?? "";
    this.clientSecret = config.clientSecret || undefined;
    this.tokens = {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken || undefined,
      expiresAt: Number(config.expiresAt ?? 0) || Date.now() + 3_500_000,
    };
    const folderName = config.folder?.trim() || "Fleetnote";
    const parent = config.appDataFolder === "true" ? "appDataFolder" : "root";
    this.rootId = await this.ensureFolder(folderName, parent);
    this.folderIdByPath.clear();
    this.folderIdByPath.set("", this.rootId);
    return true;
  }

  private async token(): Promise<string> {
    if (!this.tokens) throw new Error("Адаптер не подключён");
    if (this.tokens.expiresAt - 60_000 < Date.now() && this.tokens.refreshToken) {
      this.tokens = await refreshToken({
        clientId: this.clientId,
        refreshToken: this.tokens.refreshToken,
        clientSecret: this.clientSecret,
      });
    }
    return this.tokens.accessToken;
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await this.token()}`, ...(init.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`Google Drive ${response.status}: ${await response.text()}`);
    return (await response.json()) as T;
  }

  private async ensureFolder(name: string, parentId: string): Promise<string> {
    const query = encodeURIComponent(
      `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false and '${parentId}' in parents`,
    );
    const spaces = parentId === "appDataFolder" ? "&spaces=appDataFolder" : "";
    const found = await this.api<{ files: DriveFile[] }>(`/files?q=${query}&fields=files(id,name)${spaces}`);
    if (found.files.length && found.files[0]) return found.files[0].id;
    const created = await this.api<DriveFile>("/files?fields=id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return created.id;
  }

  async listFiles(): Promise<RemoteFileMeta[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const query = encodeURIComponent(`trashed = false and '${this.rootId}' in parents`);
      void query;
      const params = new URLSearchParams({
        q: `trashed = false`,
        fields: "nextPageToken, files(id,name,mimeType,modifiedTime,size,parents)",
        pageSize: "1000",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await this.api<{ files: DriveFile[]; nextPageToken?: string }>(
        `/files?${params.toString()}`,
      );
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);

    // Восстанавливаем дерево путей: Drive хранит только parents, а нам нужны пути базы.
    const byId = new Map(files.map((file) => [file.id, file]));
    const pathOf = (file: DriveFile, depth = 0): string | null => {
      if (depth > 16) return null;
      const parent = file.parents?.[0];
      if (!parent) return null;
      if (parent === this.rootId) return file.name;
      const parentFile = byId.get(parent);
      if (!parentFile) return null;
      const parentPath = pathOf(parentFile, depth + 1);
      return parentPath === null ? null : join(parentPath, file.name);
    };

    this.idByPath.clear();
    this.folderIdByPath.clear();
    this.folderIdByPath.set("", this.rootId);
    const out: RemoteFileMeta[] = [];
    for (const file of files) {
      const path = pathOf(file);
      if (!path) continue;
      if (file.mimeType === FOLDER_MIME) {
        this.folderIdByPath.set(path, file.id);
        continue;
      }
      this.idByPath.set(path, file.id);
      out.push({
        path,
        mtime: file.modifiedTime ? new Date(file.modifiedTime).getTime() : 0,
        size: file.size ? Number(file.size) : undefined,
      });
    }
    return out;
  }

  async readFile(path: string): Promise<string | Uint8Array> {
    const id = this.idByPath.get(path);
    if (!id) throw new Error(`Файл не найден на Диске: ${path}`);
    const response = await fetch(`${API}/files/${id}?alt=media`, {
      headers: { Authorization: `Bearer ${await this.token()}` },
    });
    if (!response.ok) throw new Error(`Google Drive ${response.status}`);
    if (isMarkdown(path)) return response.text();
    return new Uint8Array(await response.arrayBuffer());
  }

  async writeFile(path: string, content: string | Uint8Array, mtime: number): Promise<void> {
    const parentId = await this.ensurePath(dirname(path));
    const existing = this.idByPath.get(path);
    const metadata: Record<string, unknown> = {
      name: path.split("/").pop(),
      modifiedTime: new Date(mtime || Date.now()).toISOString(),
    };
    if (!existing) metadata.parents = [parentId];

    const boundary = `fleetnote-${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${isMarkdown(path) ? "text/markdown" : "application/octet-stream"}\r\n\r\n`,
      typeof content === "string" ? content : new Blob([content.slice()]),
      `\r\n--${boundary}--\r\n`,
    ]);

    const url = existing
      ? `${UPLOAD}/files/${existing}?uploadType=multipart&fields=id`
      : `${UPLOAD}/files?uploadType=multipart&fields=id`;
    const response = await fetch(url, {
      method: existing ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!response.ok) throw new Error(`Google Drive upload ${response.status}: ${await response.text()}`);
    const json = (await response.json()) as { id: string };
    this.idByPath.set(path, json.id);
  }

  async deleteFile(path: string): Promise<void> {
    const id = this.idByPath.get(path);
    if (!id) return;
    await fetch(`${API}/files/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await this.token()}` },
    });
    this.idByPath.delete(path);
  }

  /** Создаёт отсутствующие папки по пути и возвращает id последней. */
  private async ensurePath(dir: string): Promise<string> {
    if (!dir) return this.rootId;
    const known = this.folderIdByPath.get(dir);
    if (known) return known;
    const parentId = await this.ensurePath(dirname(dir));
    const name = dir.split("/").pop() ?? dir;
    const id = await this.ensureFolder(name, parentId);
    this.folderIdByPath.set(dir, id);
    return id;
  }
}
