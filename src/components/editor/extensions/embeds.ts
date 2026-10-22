import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { type Range } from "@codemirror/state";

const EMBED_RE = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export interface EmbedResolver {
  /** Ссылка на файл базы или null, если такого файла нет. */
  resolve(target: string): Promise<string | null>;
  /** Открыть файл во вкладке — по клику на вложении, которое не картинка. */
  open(target: string): void;
}

class EmbedWidget extends WidgetType {
  constructor(
    private target: string,
    private alias: string | undefined,
    private resolver: EmbedResolver,
  ) {
    super();
  }

  override eq(other: EmbedWidget): boolean {
    return other.target === this.target && other.alias === this.alias;
  }

  toDOM(): HTMLElement {
    const host = document.createElement("span");
    host.className = "cm-embed";
    const image = document.createElement("img");
    image.alt = this.alias ?? this.target;
    image.className = "cm-embed-image";
    if (this.alias && /^\d+$/.test(this.alias)) image.style.width = `${this.alias}px`;
    host.append(image);

    // Ссылку достаём асинхронно: путь к файлу превращается в URL в файловой системе
    void this.resolver.resolve(this.target).then((url) => {
      if (url) {
        image.src = url;
        return;
      }
      const missing = document.createElement("button");
      missing.type = "button";
      missing.className = "cm-embed-missing";
      missing.textContent = `Вложение не найдено: ${this.target}`;
      missing.addEventListener("click", () => this.resolver.open(this.target));
      host.replaceChildren(missing);
    });
    return host;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/** Показывает `![[картинка.png]]` и `![](файл.png)` прямо в тексте заметки. */
export function imageEmbeds(resolver: EmbedResolver, enabled: () => boolean) {
  const build = (view: EditorView): DecorationSet => {
    if (!enabled()) return Decoration.none;
    const marks: Range<Decoration>[] = [];
    const doc = view.state.doc;
    const active = new Set<number>();
    if (view.hasFocus) {
      for (const range of view.state.selection.ranges) {
        const first = doc.lineAt(range.from).number;
        const last = doc.lineAt(range.to).number;
        for (let line = first; line <= last; line++) active.add(line);
      }
    }

    for (const { from, to } of view.visibleRanges) {
      const startLine = doc.lineAt(from).number;
      const endLine = doc.lineAt(to).number;
      for (let number = startLine; number <= endLine; number++) {
        if (active.has(number)) continue;
        const line = doc.line(number);
        for (const [regex, targetIndex, aliasIndex] of [
          [EMBED_RE, 1, 2],
          [MD_IMAGE_RE, 2, 1],
        ] as const) {
          regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(line.text))) {
            const target = match[targetIndex]?.trim();
            if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
            marks.push(
              Decoration.replace({
                widget: new EmbedWidget(target, match[aliasIndex]?.trim(), resolver),
              }).range(line.from + match.index, line.from + match.index + match[0].length),
            );
          }
        }
      }
    }
    return Decoration.set(marks, true);
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (value) => value.decorations },
  );
}
