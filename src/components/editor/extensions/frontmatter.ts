import { StateField, type EditorState } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

/**
 * Прячет YAML-блок свойств в начале файла: его редактирует панель свойств,
 * а в тексте он только мешает — Markdown принимает закрывающие «---» за заголовок.
 *
 * Блочные декорации CodeMirror принимает только из поля состояния,
 * поэтому это StateField, а не ViewPlugin.
 */
export function hideFrontmatter(enabled: () => boolean) {
  const block = Decoration.replace({ block: true });

  const compute = (state: EditorState): DecorationSet => {
    if (!enabled()) return Decoration.none;
    const doc = state.doc;
    if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return Decoration.none;
    for (let number = 2; number <= Math.min(doc.lines, 200); number++) {
      const line = doc.line(number);
      if (line.text.trim() !== "---") continue;
      // Курсор внутри блока — показываем его как есть, чтобы не терять возможность правки
      if (state.selection.main.head <= line.to) return Decoration.none;
      return Decoration.set([block.range(0, line.to)]);
    }
    return Decoration.none;
  };

  return StateField.define<DecorationSet>({
    create: compute,
    update: (value, transaction) =>
      transaction.docChanged || transaction.selection ? compute(transaction.state) : value,
    provide: (field) => EditorView.decorations.from(field),
  });
}
