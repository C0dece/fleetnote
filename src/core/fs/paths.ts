/** Работа с путями внутри базы: только POSIX, только относительные пути. */

export function normalize(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

export function join(...parts: Array<string | undefined>): string {
  return normalize(parts.filter(Boolean).join("/"));
}

export function dirname(path: string): string {
  const p = normalize(path);
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

export function basename(path: string): string {
  const p = normalize(path);
  const i = p.lastIndexOf("/");
  return i < 0 ? p : p.slice(i + 1);
}

export function extname(path: string): string {
  const name = basename(path);
  const i = name.lastIndexOf(".");
  return i <= 0 ? "" : name.slice(i).toLowerCase();
}

/** Имя файла без расширения — оно же заголовок заметки по умолчанию. */
export function stem(path: string): string {
  const name = basename(path);
  const i = name.lastIndexOf(".");
  return i <= 0 ? name : name.slice(0, i);
}

export function isMarkdown(path: string): boolean {
  return extname(path) === ".md" || extname(path) === ".markdown";
}

export function isAttachment(path: string): boolean {
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".mp3", ".mp4", ".wav"].includes(
    extname(path),
  );
}

/** Путь, которого ещё нет: «Заметка.md» → «Заметка 2.md». */
export function uniquePath(path: string, taken: (candidate: string) => boolean): string {
  if (!taken(path)) return path;
  const dir = dirname(path);
  const ext = extname(path);
  const base = stem(path);
  for (let n = 2; n < 1000; n++) {
    const candidate = join(dir, `${base} ${n}${ext}`);
    if (!taken(candidate)) return candidate;
  }
  return join(dir, `${base} ${Date.now()}${ext}`);
}

/** Запрещённые в именах файлов символы заменяем, чтобы база оставалась переносимой между ОС. */
export function sanitizeName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
