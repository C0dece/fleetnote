/** Разбор Markdown: заголовки, [[WikiLinks]], #теги, задачи, frontmatter. */

export interface WikiLink {
  /** То, что написано до `#` и `|`: имя заметки или путь. */
  target: string;
  heading?: string;
  alias?: string;
  from: number;
  to: number;
}

export interface Heading {
  level: number;
  text: string;
  line: number;
}

export interface ParsedNote {
  title: string;
  headings: Heading[];
  links: WikiLink[];
  mdLinks: string[];
  tags: string[];
  tasks: { total: number; done: number };
  frontmatter: Record<string, string>;
  excerpt: string;
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
const EMBED_RE = /!\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
const MD_LINK_RE = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;
const TAG_RE = /(?:^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu;
const FENCE_RE = /^(?:\s{0,3})(`{3,}|~{3,})/;

/** Маскируем код, чтобы ссылки и теги из примеров не попали в индекс. */
export function maskCode(text: string): string {
  const lines = text.split("\n");
  let fence: string | null = null;
  const out = lines.map((line) => {
    const match = FENCE_RE.exec(line);
    if (match) {
      const marker = match[1];
      if (fence && marker.startsWith(fence[0])) {
        fence = null;
        return " ".repeat(line.length);
      }
      if (!fence) {
        fence = marker;
        return " ".repeat(line.length);
      }
    }
    if (fence) return " ".repeat(line.length);
    return line.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
  });
  return out.join("\n");
}

export function parseFrontmatter(text: string): { frontmatter: Record<string, string>; body: string } {
  if (!text.startsWith("---")) return { frontmatter: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { frontmatter: {}, body: text };
  const block = text.slice(4, end);
  const frontmatter: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) frontmatter[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const bodyStart = text.indexOf("\n", end + 1);
  return { frontmatter, body: bodyStart < 0 ? "" : text.slice(bodyStart + 1) };
}

export function parseWikiLinks(masked: string): WikiLink[] {
  const links: WikiLink[] = [];
  for (const re of [WIKILINK_RE, EMBED_RE]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(masked))) {
      const target = match[1].trim();
      if (!target) continue;
      links.push({
        target,
        heading: match[2]?.trim(),
        alias: match[3]?.trim(),
        from: match.index,
        to: match.index + match[0].length,
      });
    }
  }
  return links.sort((a, b) => a.from - b.from);
}

export function parseTags(masked: string): string[] {
  const tags = new Set<string>();
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(masked))) {
    const tag = match[1];
    // «#1», «#2026» — это обычный текст, а не тег
    if (/^\d+$/.test(tag)) continue;
    tags.add(tag);
  }
  return [...tags];
}

export function parseHeadings(body: string): Heading[] {
  const headings: Heading[] = [];
  const masked = maskCode(body).split("\n");
  body.split("\n").forEach((line, index) => {
    if (!/^#{1,6}\s/.test(masked[index] ?? "")) return;
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match) headings.push({ level: match[1].length, text: match[2].trim(), line: index });
  });
  return headings;
}

export function parseTasks(body: string): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const line of body.split("\n")) {
    const match = /^\s*[-*+]\s+\[([ xX])\]\s/.exec(line);
    if (!match) continue;
    total += 1;
    if (match[1] !== " ") done += 1;
  }
  return { total, done };
}

export function parseMdLinks(masked: string): string[] {
  const out: string[] = [];
  MD_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MD_LINK_RE.exec(masked))) {
    const href = match[1];
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("#")) continue; // внешние ссылки и анкоры
    out.push(decodeURI(href));
  }
  return out;
}

/** Заголовок заметки: frontmatter `title`, первый H1 или имя файла. */
export function noteTitle(fileStem: string, parsed: Pick<ParsedNote, "frontmatter" | "headings">): string {
  const fromMeta = parsed.frontmatter.title;
  if (fromMeta) return fromMeta.replace(/^["']|["']$/g, "");
  const h1 = parsed.headings.find((h) => h.level === 1);
  return h1?.text || fileStem;
}

export function parseNote(fileStem: string, text: string): ParsedNote {
  const { frontmatter, body } = parseFrontmatter(text);
  const masked = maskCode(body);
  const headings = parseHeadings(body);
  const parsed: ParsedNote = {
    title: "",
    headings,
    links: parseWikiLinks(masked),
    mdLinks: parseMdLinks(masked),
    tags: parseTags(masked),
    tasks: parseTasks(body),
    frontmatter,
    excerpt: excerptOf(body),
  };
  parsed.title = noteTitle(fileStem, parsed);
  return parsed;
}

function excerptOf(body: string, limit = 180): string {
  const plain = body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(
      /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
      (_m, target: string, alias?: string) => alias || target,
    )
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
}

/** Переписать `[[Старое имя]]` на `[[Новое имя]]` при переименовании заметки. */
export function rewriteWikiLinks(text: string, from: string, to: string): string {
  return text.replace(WIKILINK_RE, (full, target: string, heading?: string, alias?: string) => {
    if (target.trim().toLowerCase() !== from.toLowerCase()) return full;
    const tail = `${heading ? `#${heading}` : ""}${alias ? `|${alias}` : ""}`;
    return `[[${to}${tail}]]`;
  });
}
