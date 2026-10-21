import { EditorSelection, type StateCommand } from "@codemirror/state";
import { keymap } from "@codemirror/view";

/** Команды форматирования: одни и те же для горячих клавиш ПК и кнопок мобильного тулбара. */

function wrapSelection(before: string, after = before): StateCommand {
  return ({ state, dispatch }) => {
    const changes = state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);
      const wrapped =
        text.length >= before.length + after.length && text.startsWith(before) && text.endsWith(after);
      if (wrapped) {
        const inner = text.slice(before.length, text.length - after.length);
        return {
          changes: { from: range.from, to: range.to, insert: inner },
          range: EditorSelection.range(range.from, range.from + inner.length),
        };
      }
      return {
        changes: { from: range.from, to: range.to, insert: `${before}${text}${after}` },
        range: range.empty
          ? EditorSelection.cursor(range.from + before.length)
          : EditorSelection.range(range.from + before.length, range.from + before.length + text.length),
      };
    });
    dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

export const toggleBold = wrapSelection("**");
export const toggleItalic = wrapSelection("*");
export const toggleInlineCode = wrapSelection("`");
export const toggleStrikethrough = wrapSelection("~~");

export const insertWikiLink: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to);
  dispatch(
    state.update({
      changes: { from: range.from, to: range.to, insert: `[[${text}]]` },
      selection: { anchor: range.from + 2 + text.length },
      userEvent: "input.link",
    }),
  );
  return true;
};

export const insertTag: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main;
  dispatch(
    state.update({
      changes: { from: range.from, to: range.to, insert: "#" },
      selection: { anchor: range.from + 1 },
      userEvent: "input.tag",
    }),
  );
  return true;
};

/** Включить/выключить чекбокс на всех выделенных строках. */
export const toggleTask: StateCommand = ({ state, dispatch }) => {
  const changes: Array<{ from: number; to: number; insert: string }> = [];
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let number = first; number <= last; number++) {
      const line = state.doc.line(number);
      const task = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]\s?/.exec(line.text);
      if (task) {
        const at = line.from + task[1].length + 1;
        changes.push({ from: at, to: at + 1, insert: task[2] === " " ? "x" : " " });
        continue;
      }
      const bullet = /^(\s*)([-*+]\s+)?/.exec(line.text);
      const indent = bullet?.[1] ?? "";
      const hasBullet = Boolean(bullet?.[2]);
      changes.push({
        from: line.from,
        to: line.from + indent.length + (hasBullet ? (bullet?.[2]?.length ?? 0) : 0),
        insert: `${indent}- [ ] `,
      });
    }
  }
  if (!changes.length) return false;
  dispatch(state.update({ changes, userEvent: "input.task" }));
  return true;
};

/** `H1 → H2 → … → H6 → без заголовка` для текущей строки. */
export const cycleHeading: StateCommand = ({ state, dispatch }) => {
  const line = state.doc.lineAt(state.selection.main.head);
  const match = /^(#{0,6})(\s*)/.exec(line.text);
  const level = match?.[1].length ?? 0;
  const next = level >= 6 ? 0 : level + 1;
  const insert = next === 0 ? "" : `${"#".repeat(next)} `;
  dispatch(
    state.update({
      changes: { from: line.from, to: line.from + (match?.[0].length ?? 0), insert },
      userEvent: "input.heading",
    }),
  );
  return true;
};

export function setHeading(level: number): StateCommand {
  return ({ state, dispatch }) => {
    const line = state.doc.lineAt(state.selection.main.head);
    const match = /^(#{0,6})(\s*)/.exec(line.text);
    dispatch(
      state.update({
        changes: {
          from: line.from,
          to: line.from + (match?.[0].length ?? 0),
          insert: `${"#".repeat(level)} `,
        },
        userEvent: "input.heading",
      }),
    );
    return true;
  };
}

export const formattingKeymap = keymap.of([
  { key: "Mod-b", run: toggleBold, preventDefault: true },
  { key: "Mod-i", run: toggleItalic, preventDefault: true },
  { key: "Mod-e", run: toggleInlineCode, preventDefault: true },
  { key: "Mod-Shift-x", run: toggleStrikethrough, preventDefault: true },
  { key: "Mod-Shift-l", run: insertWikiLink, preventDefault: true },
  { key: "Mod-Enter", run: toggleTask, preventDefault: true },
  { key: "Mod-h", run: cycleHeading, preventDefault: true },
]);
