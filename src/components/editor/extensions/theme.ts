import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";

/** Тема редактора целиком на CSS-переменных: смена оформления не требует пересборки. */
export const fleetnoteEditorTheme = EditorView.theme({
  "&": {
    color: "var(--fn-ink)",
    backgroundColor: "transparent",
    fontSize: "var(--fn-editor-font-size)",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: "var(--fn-font-sans)",
    lineHeight: "var(--fn-editor-line-height)",
    padding: "0 clamp(16px, 4vw, 48px) 40vh",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  ".cm-content": {
    maxWidth: "var(--fn-measure)",
    margin: "0 auto",
    caretColor: "var(--fn-accent)",
    paddingTop: "24px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-line": { padding: "0 2px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fn-accent)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--fn-selection)",
  },
  ".cm-gutters": { display: "none" },
  ".cm-heading": { fontWeight: "650", lineHeight: "1.3" },
  ".cm-h1": { fontSize: "1.7em" },
  ".cm-h2": { fontSize: "1.42em" },
  ".cm-h3": { fontSize: "1.22em" },
  ".cm-h4": { fontSize: "1.1em" },
  ".cm-h5": { fontSize: "1em" },
  ".cm-h6": { fontSize: "0.95em", color: "var(--fn-ink-muted)" },
  ".cm-wikilink": { color: "var(--fn-accent)", cursor: "pointer", textDecoration: "none" },
  ".cm-wikilink:hover": { textDecoration: "underline" },
  ".cm-tag": {
    color: "var(--fn-accent-soft-ink)",
    backgroundColor: "var(--fn-accent-soft)",
    borderRadius: "4px",
    padding: "1px 5px",
    cursor: "pointer",
  },
  ".cm-task-checkbox": {
    appearance: "none",
    width: "16px",
    height: "16px",
    marginRight: "6px",
    verticalAlign: "-2px",
    border: "1.5px solid var(--fn-ink-muted)",
    borderRadius: "4px",
    cursor: "pointer",
  },
  ".cm-task-checkbox:checked": {
    backgroundColor: "var(--fn-ok)",
    borderColor: "var(--fn-ok)",
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3 8.5l3 3 7-7' stroke='white' stroke-width='2' fill='none' stroke-linecap='round'/></svg>\")",
    backgroundSize: "contain",
  },
  ".cm-task-done": { color: "var(--fn-ink-muted)", textDecoration: "line-through" },
  ".cm-tooltip": {
    backgroundColor: "var(--fn-panel)",
    border: "1px solid var(--fn-hairline)",
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow: "var(--fn-shadow)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--fn-accent)",
    color: "#fff",
  },
  ".cm-tooltip-autocomplete ul li": { padding: "6px 10px" },
});

export const fleetnoteHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading, fontWeight: "650" },
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.link, color: "var(--fn-accent)" },
    { tag: tags.url, color: "var(--fn-ink-muted)" },
    { tag: tags.quote, color: "var(--fn-ink-muted)", fontStyle: "italic" },
    { tag: tags.monospace, fontFamily: "var(--fn-font-mono)", fontSize: "0.92em" },
    { tag: tags.keyword, color: "var(--fn-accent)" },
    { tag: tags.comment, color: "var(--fn-ink-muted)", fontStyle: "italic" },
    { tag: tags.string, color: "var(--fn-ok)" },
    { tag: tags.number, color: "var(--fn-warn)" },
  ]),
);
