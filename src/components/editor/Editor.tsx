import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState, type StateCommand } from "@codemirror/state";
import { EditorView, keymap, drawSelection, dropCursor, placeholder } from "@codemirror/view";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { livePreview } from "./extensions/livePreview";
import { fleetnoteCompletion } from "./extensions/completion";
import { fleetnoteEditorTheme, fleetnoteHighlight } from "./extensions/theme";
import { attachmentPaste } from "./extensions/attachments";
import { formattingKeymap } from "./extensions/commands";

export interface EditorHandle {
  run(command: StateCommand): void;
  focus(): void;
  view(): EditorView | null;
}

export interface EditorProps {
  /** Путь открытой заметки: его смена сбрасывает историю отмен. */
  path: string;
  value: string;
  readOnly?: boolean;
  onChange(text: string): void;
  onOpenLink(target: string): void;
  onOpenTag(tag: string): void;
  notes(): Array<{ title: string; path: string }>;
  tags(): Array<{ tag: string; count: number }>;
  onPasteFile(file: File): Promise<string | null>;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  // Колбэки держим в ref: расширения CodeMirror создаются один раз.
  const latest = useRef(props);
  latest.current = props;
  const lastPushed = useRef<string>(props.value);

  useImperativeHandle(ref, () => ({
    run(command) {
      const current = view.current;
      if (!current) return;
      command({ state: current.state, dispatch: (transaction) => current.dispatch(transaction) });
      current.focus();
    },
    focus() {
      view.current?.focus();
    },
    view() {
      return view.current;
    },
  }));

  useEffect(() => {
    if (!host.current) return;

    const extensions = [
      history(),
      drawSelection(),
      dropCursor(),
      EditorView.lineWrapping,
      closeBrackets(),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      formattingKeymap,
      markdown({ base: markdownLanguage, addKeymap: true }),
      fleetnoteHighlight,
      fleetnoteEditorTheme,
      placeholder("Пишите в Markdown. [[ — ссылка, # — тег, Ctrl/Cmd+K — палитра команд"),
      livePreview({
        onOpenLink: (target) => latest.current.onOpenLink(target),
        onOpenTag: (tag) => latest.current.onOpenTag(tag),
      }),
      fleetnoteCompletion({
        notes: () => latest.current.notes(),
        tags: () => latest.current.tags(),
      }),
      attachmentPaste((file) => latest.current.onPasteFile(file)),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        const text = update.state.doc.toString();
        lastPushed.current = text;
        latest.current.onChange(text);
      }),
      EditorState.readOnly.of(Boolean(props.readOnly)),
    ];

    const instance = new EditorView({
      state: EditorState.create({ doc: props.value, extensions }),
      parent: host.current,
    });
    view.current = instance;
    return () => {
      instance.destroy();
      view.current = null;
    };
    // Пересоздаём редактор при смене заметки — так сбрасывается история отмен,
    // и Ctrl+Z не «переезжает» между файлами.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.path, props.readOnly]);

  // Внешнее изменение текста (синхронизация подтянула версию из облака).
  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    if (props.value === lastPushed.current) return;
    const current = instance.state.doc.toString();
    if (current === props.value) return;
    const selection = instance.state.selection.main;
    instance.dispatch({
      changes: { from: 0, to: current.length, insert: props.value },
      selection: { anchor: Math.min(selection.anchor, props.value.length) },
    });
    lastPushed.current = props.value;
  }, [props.value]);

  return <div ref={host} className="h-full min-h-0 w-full" data-fn-editor={props.path} />;
});
