import type { IStorageAdapter, RemoteFileMeta } from "../types";
import { isMarkdown, normalize } from "../../fs/paths";

/**
 * AWS S3, Cloudflare R2, MinIO.
 * SDK подгружается динамически: он большой и нужен только при выборе этого адаптера.
 */
export class S3Adapter implements IStorageAdapter {
  readonly id = "s3" as const;
  readonly label = "S3 / R2 / MinIO";

  private client: import("@aws-sdk/client-s3").S3Client | null = null;
  private sdk: typeof import("@aws-sdk/client-s3") | null = null;
  private bucket = "";
  private prefix = "";

  async connect(config: Record<string, string>): Promise<boolean> {
    if (!config.bucket) throw new Error("Укажите бакет");
    try {
      this.sdk = await import("@aws-sdk/client-s3");
    } catch {
      throw new Error("Не установлен @aws-sdk/client-s3: выполните npm install @aws-sdk/client-s3");
    }
    this.bucket = config.bucket;
    this.prefix = config.prefix ? `${normalize(config.prefix)}/` : "";
    this.client = new this.sdk.S3Client({
      region: config.region || "auto",
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle === "true",
      credentials: { accessKeyId: config.accessKeyId ?? "", secretAccessKey: config.secretAccessKey ?? "" },
    });
    await this.client.send(
      new this.sdk.ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1, Prefix: this.prefix }),
    );
    return true;
  }

  private require(): {
    client: import("@aws-sdk/client-s3").S3Client;
    sdk: typeof import("@aws-sdk/client-s3");
  } {
    if (!this.client || !this.sdk) throw new Error("Адаптер не подключён");
    return { client: this.client, sdk: this.sdk };
  }

  private key(path: string): string {
    return `${this.prefix}${normalize(path)}`;
  }

  async listFiles(): Promise<RemoteFileMeta[]> {
    const { client, sdk } = this.require();
    const out: RemoteFileMeta[] = [];
    let token: string | undefined;
    do {
      const page = await client.send(
        new sdk.ListObjectsV2Command({ Bucket: this.bucket, Prefix: this.prefix, ContinuationToken: token }),
      );
      for (const object of page.Contents ?? []) {
        if (!object.Key || object.Key.endsWith("/")) continue;
        out.push({
          path: object.Key.slice(this.prefix.length),
          mtime: object.LastModified ? object.LastModified.getTime() : 0,
          size: object.Size,
          // ETag — это md5 для простых загрузок, как хэш не используем, только для сравнения «изменилось ли».
          hash: undefined,
        });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  async readFile(path: string): Promise<string | Uint8Array> {
    const { client, sdk } = this.require();
    const response = await client.send(
      new sdk.GetObjectCommand({ Bucket: this.bucket, Key: this.key(path) }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Пустой ответ S3 для ${path}`);
    return isMarkdown(path) ? new TextDecoder().decode(bytes) : bytes;
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    const { client, sdk } = this.require();
    await client.send(
      new sdk.PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(path),
        Body: typeof content === "string" ? new TextEncoder().encode(content) : content,
        ContentType: isMarkdown(path) ? "text/markdown; charset=utf-8" : "application/octet-stream",
      }),
    );
  }

  async deleteFile(path: string): Promise<void> {
    const { client, sdk } = this.require();
    await client.send(new sdk.DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(path) }));
  }
}
