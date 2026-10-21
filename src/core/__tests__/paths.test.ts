import { describe, expect, it } from "vitest";
import { dirname, extname, isMarkdown, join, normalize, sanitizeName, stem, uniquePath } from "../fs/paths";
import { conflictPath } from "../sync/manifest";

describe("пути внутри базы", () => {
  it("нормализует разделители и точки", () => {
    expect(normalize("Daily\\2026/./note.md")).toBe("Daily/2026/note.md");
    expect(normalize("/a/b/../c/")).toBe("a/c");
  });

  it("разбирает имя и расширение", () => {
    expect(dirname("Daily/2026-10-21.md")).toBe("Daily");
    expect(stem("Daily/2026-10-21.md")).toBe("2026-10-21");
    expect(extname("note.MD")).toBe(".md");
    expect(isMarkdown("note.md")).toBe(true);
    expect(isMarkdown("note.png")).toBe(false);
  });

  it("подбирает свободное имя", () => {
    const taken = new Set(["Заметка.md", "Заметка 2.md"]);
    expect(uniquePath("Заметка.md", (candidate) => taken.has(candidate))).toBe("Заметка 3.md");
  });

  it("чистит имя файла от запрещённых символов", () => {
    expect(sanitizeName('про: a/b *"?')).toBe("про- a-b ---");
    expect(join("Daily", "note.md")).toBe("Daily/note.md");
  });

  it("строит имя конфликтной копии", () => {
    const at = new Date(2026, 9, 21, 14, 32);
    expect(conflictPath("Daily/note.md", at)).toBe("Daily/note (Conflict 2026-10-21 14-32).md");
  });
});
