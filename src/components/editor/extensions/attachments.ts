import { EditorView } from "@codemirror/view";

/**
 * Вставка картинок из буфера обмена и drag&drop.
 * Файл сохраняется в базу через переданный колбэк, в текст уходит `![[путь]]`.
 */
export function attachmentPaste(onFile: (file: File) => Promise<string | null>) {
  const insert = (view: EditorView, files: File[]): void => {
    void (async () => {
      for (const file of files) {
        const path = await onFile(file);
        if (!path) continue;
        const range = view.state.selection.main;
        view.dispatch({
          changes: { from: range.from, to: range.to, insert: `![[${path}]]\n` },
          selection: { anchor: range.from + path.length + 6 },
          userEvent: "input.attachment",
        });
      }
    })();
  };

  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
      if (!files.length) return false;
      event.preventDefault();
      insert(view, files);
      return true;
    },
    drop(event, view) {
      const files = [...(event.dataTransfer?.files ?? [])].filter(
        (file) => file.type.startsWith("image/") || file.type === "application/pdf",
      );
      if (!files.length) return false;
      event.preventDefault();
      insert(view, files);
      return true;
    },
  });
}
