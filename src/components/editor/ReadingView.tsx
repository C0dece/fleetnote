import { useEffect, useMemo, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { parseProperties } from "@/core/vault/frontmatter";
import { fileKind } from "@/core/fs/assets";

export interface ReadingEmbeds {
  /** Путь заметки по цели ссылки. */
  resolveNote(target: string): string | null;
  /** Путь файла базы по цели вложения. */
  resolveFile(target: string): string | null;
  assetUrl(path: string): Promise<string>;
  readNote(path: string): Promise<string>;
  open(path: string): void;
}

/**
 * Режим чтения: только результат, без разметки.
 * Ссылки, теги, картинки и встроенные заметки остаются живыми.
 */
export function ReadingView({
  text,
  embeds,
  onOpenLink,
  onOpenTag,
  onToggleTask,
}: {
  text: string;
  embeds: ReadingEmbeds;
  onOpenLink(target: string): void;
  onOpenTag(tag: string): void;
  onToggleTask(index: number, checked: boolean): void;
}) {
  const host = useRef<HTMLDivElement | null>(null);

  const html = useMemo(() => renderMarkdown(text, embeds), [text, embeds]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let alive = true;

    // Картинки и встроенные заметки дозагружаются после разметки
    element.querySelectorAll<HTMLImageElement>("img[data-embed-file]").forEach((image) => {
      const path = image.dataset.embedFile;
      if (!path) return;
      void embeds.assetUrl(path).then((url) => {
        if (alive) image.src = url;
      });
    });

    element.querySelectorAll<HTMLElement>("[data-embed-note]").forEach((block) => {
      const path = block.dataset.embedNote;
      if (!path) return;
      void embeds.readNote(path).then((noteText) => {
        if (!alive) return;
        const { body } = parseProperties(noteText);
        const inner = DOMPurify.sanitize(marked.parse(body, { async: false, gfm: true }) as string);
        const content = document.createElement("div");
        content.innerHTML = inner;
        block.querySelector(".fn-embed-body")?.replaceChildren(content);
      });
    });

    element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input, index) => {
      input.disabled = false;
      input.dataset.task = String(index);
    });

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest<HTMLElement>("[data-wikilink]");
      if (link) {
        event.preventDefault();
        onOpenLink(link.dataset.wikilink ?? "");
        return;
      }
      const file = target.closest<HTMLElement>("[data-file-link]");
      if (file) {
        event.preventDefault();
        embeds.open(file.dataset.fileLink ?? "");
        return;
      }
      const noteBlock = target.closest<HTMLElement>("[data-embed-note] .fn-embed-title");
      if (noteBlock) {
        event.preventDefault();
        const path = noteBlock.closest<HTMLElement>("[data-embed-note]")?.dataset.embedNote;
        if (path) embeds.open(path);
        return;
      }
      const tag = target.closest<HTMLElement>("[data-tag]");
      if (tag) {
        event.preventDefault();
        onOpenTag(tag.dataset.tag ?? "");
        return;
      }
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        onToggleTask(Number(target.dataset.task ?? -1), target.checked);
      }
    };

    element.addEventListener("click", onClick);
    return () => {
      alive = false;
      element.removeEventListener("click", onClick);
    };
  }, [html, embeds, onOpenLink, onOpenTag, onToggleTask]);

  return (
    <div className="h-full overflow-y-auto">
      <div
        ref={host}
        className="fn-reading fn-selectable mx-auto w-full px-[clamp(16px,4vw,48px)] pb-[40vh] pt-6"
        style={{ maxWidth: "var(--fn-measure)" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function renderMarkdown(text: string, embeds: ReadingEmbeds): string {
  const { body } = parseProperties(text);

  const prepared = body
    // ![[вложение]] — картинка, файл или встроенная заметка
    .replace(
      /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
      (_match, rawTarget: string, alias?: string) => {
        const target = rawTarget.trim();
        const file = embeds.resolveFile(target);
        if (file) {
          if (fileKind(file) === "image") {
            const width = alias && /^\d+$/.test(alias) ? ` width="${alias}"` : "";
            return `<img data-embed-file="${escapeAttr(file)}" alt="${escapeAttr(alias ?? target)}"${width} />`;
          }
          return `<a href="#" data-file-link="${escapeAttr(file)}">${escapeHtml(alias ?? target)}</a>`;
        }
        const note = embeds.resolveNote(target);
        if (note) {
          return `<div class="fn-embed-note" data-embed-note="${escapeAttr(note)}"><div class="fn-embed-title">${escapeHtml(
            alias ?? target,
          )}</div><div class="fn-embed-body"><span class="fn-embed-loading">Загружаю…</span></div></div>`;
        }
        return `<span class="fn-embed-missing">Вложение не найдено: ${escapeHtml(target)}</span>`;
      },
    )
    // обычные картинки Markdown с относительным путём
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (match, alt: string, href: string) => {
      if (/^[a-z][a-z\d+.-]*:/i.test(href)) return match;
      const file = embeds.resolveFile(decodeURI(href));
      if (!file) return match;
      return `<img data-embed-file="${escapeAttr(file)}" alt="${escapeAttr(alt)}" />`;
    })
    .replace(
      /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
      (_match, target: string, _heading, alias?: string) =>
        `<a href="#" data-wikilink="${escapeAttr(target.trim())}">${escapeHtml((alias ?? target).trim())}</a>`,
    )
    .replace(
      /(^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu,
      (_match, prefix: string, tag: string) =>
        `${prefix}<span class="fn-tag" data-tag="${escapeAttr(tag)}">#${escapeHtml(tag)}</span>`,
    );

  const rendered = marked.parse(prepared, { async: false, gfm: true, breaks: false }) as string;
  return DOMPurify.sanitize(rendered, {
    ADD_ATTR: [
      "data-wikilink",
      "data-tag",
      "data-task",
      "data-embed-file",
      "data-embed-note",
      "data-file-link",
    ],
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
  );
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
