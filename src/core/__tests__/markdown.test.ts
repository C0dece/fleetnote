import { describe, expect, it } from "vitest";
import { maskCode, parseNote, rewriteWikiLinks } from "../vault/markdown";

describe("разбор заметки", () => {
  const text = `---
title: Заметка о синхронизации
---

# Заголовок

Текст со ссылкой [[Другая заметка|подпись]] и якорем [[Третья#Раздел]].
Тег #проект/альфа и #2026 (последнее — не тег).

- [x] сделано
- [ ] не сделано

\`\`\`md
[[Ссылка в коде]] и #тег-в-коде
\`\`\`
`;

  const parsed = parseNote("файл", text);

  it("берёт заголовок из frontmatter", () => {
    expect(parsed.title).toBe("Заметка о синхронизации");
  });

  it("находит вики-ссылки с подписью и якорем", () => {
    expect(parsed.links.map((link) => link.target)).toEqual(["Другая заметка", "Третья"]);
    expect(parsed.links[0].alias).toBe("подпись");
    expect(parsed.links[1].heading).toBe("Раздел");
  });

  it("собирает теги и игнорирует числа", () => {
    expect(parsed.tags).toEqual(["проект/альфа"]);
  });

  it("считает задачи", () => {
    expect(parsed.tasks).toEqual({ total: 2, done: 1 });
  });

  it("не индексирует содержимое блоков кода", () => {
    expect(parsed.links.some((link) => link.target === "Ссылка в коде")).toBe(false);
    expect(maskCode("`[[нет]]`").trim()).toBe("");
  });

  it("переписывает ссылки при переименовании", () => {
    expect(rewriteWikiLinks("см. [[Старое|как было]]", "Старое", "Новое")).toBe("см. [[Новое|как было]]");
    expect(rewriteWikiLinks("[[Чужое]]", "Старое", "Новое")).toBe("[[Чужое]]");
  });
});
