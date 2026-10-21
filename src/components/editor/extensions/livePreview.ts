import { syntaxTree } from "@codemirror/language";
import { type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

/**
 * Live Preview: разметка скрывается на строках без курсора, заголовки растут в кегле,
 * чекбоксы и [[ссылки]] становятся интерактивными. Это тот же принцип, что в Obsidian.
 */

const HIDE_NODES = new Set([
  "HeaderMark",
  "EmphasisMark",
  "StrikethroughMark",
  "CodeMark",
  "LinkMark",
  "QuoteMark",
]);

const WIKILINK_RE = /(!?)\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
const TAG_RE = /(?:^|[\s(])(#[\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu;
const TASK_RE = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]/;

class CheckboxWidget extends WidgetType {
  constructor(
    private checked: boolean,
    private pos: number,
  ) {
    super();
  }

  override eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.pos === this.pos;
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "cm-task-checkbox";
    input.checked = this.checked;
    input.setAttribute("aria-label", this.checked ? "Снять отметку" : "Отметить выполненным");
    input.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({
        changes: { from: this.pos, to: this.pos + 3, insert: this.checked ? "[ ]" : "[x]" },
      });
    });
    return input;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

const hidden = Decoration.replace({});

/**
 * Строки, на которых стоит курсор: на них разметка показывается как есть.
 * Без фокуса таких строк нет — иначе заголовок открытой заметки всегда
 * висел бы с решёткой, хотя никто в ней не редактирует.
 */
function activeLines(view: EditorView): Set<number> {
  const lines = new Set<number>();
  if (!view.hasFocus) return lines;
  for (const range of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(range.to).number;
    for (let line = first; line <= last; line++) lines.add(line);
  }
  return lines;
}

function buildDecorations(view: EditorView): DecorationSet {
  /** replace-декорации не могут перекрываться, остальные — могут. */
  const replaces: Range<Decoration>[] = [];
  const marks: Range<Decoration>[] = [];
  const active = activeLines(view);
  const doc = view.state.doc;

  // Разметка Markdown по дереву разбора.
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const line = doc.lineAt(node.from);
        if (node.name.startsWith("ATXHeading")) {
          const level = Number(node.name.slice(-1));
          if (Number.isFinite(level)) {
            marks.push(Decoration.line({ class: `cm-heading cm-h${level}` }).range(line.from));
          }
          return;
        }
        if (!HIDE_NODES.has(node.name) || active.has(line.number)) return;
        let end = node.to;
        if (node.name === "HeaderMark") {
          // прячем решётки вместе с пробелом после них
          while (end < line.to && doc.sliceString(end, end + 1) === " ") end += 1;
        }
        if (end > node.from) replaces.push(hidden.range(node.from, end));
      },
    });
  }

  // [[Вики-ссылки]], #теги и чекбоксы — регулярками: их нет в стандартном парсере Markdown.
  for (const { from, to } of view.visibleRanges) {
    const startLine = doc.lineAt(from).number;
    const endLine = doc.lineAt(to).number;
    for (let number = startLine; number <= endLine; number++) {
      const line = doc.line(number);
      const text = line.text;
      const isActive = active.has(number);

      const task = TASK_RE.exec(text);
      if (task) {
        const at = line.from + task[1].length;
        replaces.push(
          Decoration.replace({ widget: new CheckboxWidget(task[2] !== " ", at) }).range(at, at + 3),
        );
        // Перечёркиваем только текст задачи, не маркер списка перед чекбоксом
        if (task[2] !== " " && line.to > at + 3) {
          marks.push(Decoration.mark({ class: "cm-task-done" }).range(at + 3, line.to));
        }
      }

      WIKILINK_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = WIKILINK_RE.exec(text))) {
        const start = line.from + match.index;
        const target = match[2].trim();
        const label = match[4]?.trim() || target;
        const openLen = match[1] === "!" ? 3 : 2;
        marks.push(
          Decoration.mark({
            class: "cm-wikilink",
            attributes: { "data-wikilink": target, title: `Открыть «${label}»` },
          }).range(start, start + match[0].length),
        );
        if (!isActive) {
          replaces.push(hidden.range(start, start + openLen));
          replaces.push(hidden.range(start + match[0].length - 2, start + match[0].length));
          // при наличии псевдонима прячем и цель, и вертикальную черту: остаётся только подпись
          if (match[4]) {
            const pipe = start + match[0].indexOf("|");
            replaces.push(hidden.range(start + openLen, pipe + 1));
          }
        }
      }

      TAG_RE.lastIndex = 0;
      while ((match = TAG_RE.exec(text))) {
        const tag = match[1];
        const at = line.from + match.index + match[0].indexOf(tag);
        marks.push(
          Decoration.mark({ class: "cm-tag", attributes: { "data-tag": tag.slice(1) } }).range(
            at,
            at + tag.length,
          ),
        );
      }
    }
  }

  return Decoration.set([...dedupeReplaces(replaces), ...marks], true);
}

/** Перекрывающиеся replace-диапазоны CodeMirror не принимает — оставляем первый. */
function dedupeReplaces(replaces: Range<Decoration>[]): Range<Decoration>[] {
  // При равном начале оставляем более длинный диапазон: иначе от `[[ссылки]]`
  // остаётся лишняя скобка — внутренний LinkMark перекрывает наш.
  const sorted = [...replaces].sort((a, b) => a.from - b.from || b.to - a.to);
  const out: Range<Decoration>[] = [];
  let lastEnd = -1;
  for (const range of sorted) {
    if (range.from < lastEnd) continue;
    lastEnd = range.to;
    out.push(range);
  }
  return out;
}

export interface LivePreviewHandlers {
  onOpenLink?: (target: string) => void;
  onOpenTag?: (tag: string) => void;
}

export function livePreview(handlers: LivePreviewHandlers = {}) {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (value) => value.decorations },
  );

  const clicks = EditorView.domEventHandlers({
    mousedown(event) {
      const element = event.target as HTMLElement | null;
      const link = element?.closest<HTMLElement>("[data-wikilink]");
      if (link && (event.metaKey || event.ctrlKey || event.detail === 2 || event.button === 0)) {
        const target = link.getAttribute("data-wikilink");
        if (target && handlers.onOpenLink) {
          event.preventDefault();
          handlers.onOpenLink(target);
          return true;
        }
      }
      const tag = element?.closest<HTMLElement>("[data-tag]");
      if (tag && handlers.onOpenTag) {
        const value = tag.getAttribute("data-tag");
        if (value) {
          event.preventDefault();
          handlers.onOpenTag(value);
          return true;
        }
      }
      return false;
    },
  });

  return [plugin, clicks];
}
