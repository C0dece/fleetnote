import { describe, expect, it } from "vitest";
import { merge3 } from "../sync/merge";

describe("merge3", () => {
  it("возвращает общую версию, если изменений нет", () => {
    expect(merge3("a\nb", "a\nb", "a\nb")).toEqual({ text: "a\nb", conflicted: false });
  });

  it("берёт правку той стороны, которая менялась", () => {
    expect(merge3("a\nb\nc", "a\nB\nc", "a\nb\nc").text).toBe("a\nB\nc");
    expect(merge3("a\nb\nc", "a\nb\nc", "a\nb\nC").text).toBe("a\nb\nC");
  });

  it("сливает правки в разных местах файла", () => {
    const result = merge3("1\n2\n3\n4\n5", "1\nдва\n3\n4\n5", "1\n2\n3\n4\nпять");
    expect(result.conflicted).toBe(false);
    expect(result.text).toBe("1\nдва\n3\n4\nпять");
  });

  it("добавления в разные концы не конфликтуют", () => {
    const result = merge3("середина", "начало\nсередина", "середина\nконец");
    expect(result.conflicted).toBe(false);
    expect(result.text).toBe("начало\nсередина\nконец");
  });

  it("помечает конфликт, когда правки пересеклись", () => {
    const result = merge3("строка", "строка с ПК", "строка с телефона");
    expect(result.conflicted).toBe(true);
    // локальная версия остаётся в файле, удалённая уедет в копию «(Conflict …)»
    expect(result.text).toBe("строка с ПК");
  });

  it("одинаковые правки с двух сторон конфликтом не считаются", () => {
    const result = merge3("a", "b", "b");
    expect(result).toEqual({ text: "b", conflicted: false });
  });
});
