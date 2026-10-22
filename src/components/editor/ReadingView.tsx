import { useEffect, useMemo, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { parseProperties } from "@/core/vault/frontmatter";

/**
 * Режим чтения: только результат, без разметки.
 * Ссылки `[[…]]` и `#теги` остаются интерактивными.
 */
export function ReadingView({
  text,
  onOpenLink,
  onOpenTag,
  onToggleTask,
}: {
  text: string;
  onOpenLink(target: string): void;
  onOpenTag(tag: string): void;
  onToggleTask(index: number, checked: boolean): void;
}) {
  const host = useRef<HTMLDivElement | null>(null);

  const html = useMemo(() => {
    const { body } = parseProperties(text);
    const prepared = body
      .replace(
        /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
        (_match, target: string) => `*(вложение: ${target})*`,
      )
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
    return DOMPurify.sanitize(rendered, { ADD_ATTR: ["data-wikilink", "data-tag", "data-task"] });
  }, [text]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    // Нумеруем чекбоксы, чтобы отметку можно было вернуть в исходный текст
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
    return () => element.removeEventListener("click", onClick);
  }, [html, onOpenLink, onOpenTag, onToggleTask]);

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

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
  );
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
