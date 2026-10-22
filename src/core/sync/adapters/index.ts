import type { AdapterId, IStorageAdapter } from "../types";

/**
 * Адаптеры подгружаются по требованию: клиенты WebDAV и S3 тянут за собой
 * заметный объём кода, которому нечего делать в основном бандле.
 */
export async function createAdapter(id: AdapterId): Promise<IStorageAdapter> {
  switch (id) {
    case "local": {
      const { LocalFolderAdapter } = await import("./local");
      return new LocalFolderAdapter();
    }
    case "webdav": {
      const { WebDavAdapter } = await import("./webdav");
      return new WebDavAdapter();
    }
    case "gdrive": {
      const { GoogleDriveAdapter } = await import("./gdrive");
      return new GoogleDriveAdapter();
    }
    case "s3": {
      const { S3Adapter } = await import("./s3");
      return new S3Adapter();
    }
  }
}

/** Поля, которые просим у пользователя в настройках для каждого адаптера. */
export const ADAPTER_FIELDS: Record<
  AdapterId,
  Array<{ key: string; label: string; type?: "text" | "password"; placeholder?: string }>
> = {
  local: [{ key: "path", label: "Папка синхронизации", placeholder: "/home/user/Cloud/Fleetnote" }],
  webdav: [
    {
      key: "url",
      label: "Адрес сервера",
      placeholder: "https://cloud.example.com/remote.php/dav/files/user",
    },
    { key: "username", label: "Логин" },
    { key: "password", label: "Пароль приложения", type: "password" },
    { key: "path", label: "Папка на сервере", placeholder: "Fleetnote" },
  ],
  gdrive: [
    { key: "clientId", label: "OAuth Client ID", placeholder: "…apps.googleusercontent.com" },
    {
      key: "clientSecret",
      label: "Client secret (у клиента типа «Desktop app» он есть)",
      type: "password",
      placeholder: "GOCSPX-…",
    },
    { key: "folder", label: "Папка на Диске", placeholder: "Fleetnote" },
  ],
  s3: [
    { key: "bucket", label: "Бакет" },
    { key: "region", label: "Регион", placeholder: "auto" },
    { key: "endpoint", label: "Endpoint (R2/MinIO)", placeholder: "https://…r2.cloudflarestorage.com" },
    { key: "accessKeyId", label: "Access Key ID" },
    { key: "secretAccessKey", label: "Secret Access Key", type: "password" },
    { key: "prefix", label: "Префикс", placeholder: "fleetnote" },
  ],
};
