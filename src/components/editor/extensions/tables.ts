import { syntaxTree } from "@codemirror/language";
import { StateField, type EditorState, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

class TableWidget extends WidgetType {
  constructor(
    private source: string,
    private from: number,
  ) {
    super();
  }

  override eq(other: TableWidget): boolean {
    return other.source === this.source;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-preview";
    const table = document.createElement("table");

    const rows = this.source
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) =>
        line
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim()),
      );

    rows.forEach((cells, index) => {
      // вторая строка Markdown-таблицы — разделитель, её не рисуем
      if (index === 1 && cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return;
      const row = document.createElement("tr");
      for (const cell of cells) {
        const element = document.createElement(index === 0 ? "th" : "td");
        element.textContent = cell;
        row.append(element);
      }
      table.append(row);
    });

    wrapper.append(table);
    // Клик ставит курсор в исходник таблицы — так её можно отредактировать
    wrapper.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true });
      view.focus();
    });
    return wrapper;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Рисует Markdown-таблицы сеткой, пока курсор не внутри них.
 * Блочные декорации CodeMirror принимает только из поля состояния.
 */
export function tablePreview(enabled: () => boolean) {
  const compute = (state: EditorState): DecorationSet => {
    if (!enabled()) return Decoration.none;
    const marks: Range<Decoration>[] = [];
    const cursor = state.selection.main;

    syntaxTree(state).iterate({
      enter: (node) => {
        if (node.name !== "Table") return;
        // Курсор внутри — показываем исходник
        if (cursor.from <= node.to && cursor.to >= node.from) return;
        const source = state.doc.sliceString(node.from, node.to);
        if (!source.includes("|")) return;
        marks.push(
          Decoration.replace({
            widget: new TableWidget(source, node.from),
            block: true,
          }).range(node.from, node.to),
        );
      },
    });

    return Decoration.set(marks, true);
  };

  return StateField.define<DecorationSet>({
    create: compute,
    update: (value, transaction) =>
      transaction.docChanged || transaction.selection ? compute(transaction.state) : value,
    provide: (field) => EditorView.decorations.from(field),
  });
}
