import { describe, expect, it } from "vitest";
import { parseProperties, stringifyProperties } from "../vault/frontmatter";

describe("свойства заметки", () => {
  const text = `---
title: План запуска
приоритет: 2
дедлайн: 2026-11-01
готово: false
теги:
  - проект
  - альфа
---
# План

Текст заметки.
`;

  const { properties, body } = parseProperties(text);

  it("разбирает типы полей", () => {
    expect(properties.map((property) => [property.key, property.type])).toEqual([
      ["title", "text"],
      ["приоритет", "number"],
      ["дедлайн", "date"],
      ["готово", "checkbox"],
      ["теги", "list"],
    ]);
  });

  it("возвращает тело без блока свойств", () => {
    expect(body.startsWith("# План")).toBe(true);
  });

  it("переживает полный круг разбор → запись", () => {
    const written = stringifyProperties(properties, body);
    const again = parseProperties(written);
    expect(again.properties).toEqual(properties);
    expect(again.body).toBe(body);
  });

  it("пустое значение остаётся текстом, а не списком", () => {
    const parsed = parseProperties("---\nстатус:\n---\nтекст\n");
    expect(parsed.properties).toEqual([{ key: "статус", type: "text", value: "" }]);
  });

  it("текст без блока свойств не меняется", () => {
    expect(parseProperties("# Просто заметка\n")).toEqual({
      properties: [],
      body: "# Просто заметка\n",
    });
  });
});
