import { beforeEach, describe, expect, it } from "vitest";
import { MemoryVaultFs } from "../fs/memoryFs";
import { SyncEngine } from "../sync/syncEngine";
import type { IStorageAdapter, RemoteFileMeta } from "../sync/types";

/** Хранилище «в сети»: обычная карта, через которую ходит движок. */
class FakeRemote implements IStorageAdapter {
  readonly id = "local" as const;
  readonly label = "Тестовое хранилище";
  files = new Map<string, { content: string; mtime: number }>();

  async connect(): Promise<boolean> {
    return true;
  }

  async listFiles(): Promise<RemoteFileMeta[]> {
    return [...this.files].map(([path, file]) => ({ path, mtime: file.mtime }));
  }

  async readFile(path: string): Promise<string> {
    const file = this.files.get(path);
    if (!file) throw new Error(`нет файла ${path}`);
    return file.content;
  }

  async writeFile(path: string, content: string | Uint8Array, mtime: number): Promise<void> {
    this.files.set(path, {
      content: typeof content === "string" ? content : new TextDecoder().decode(content),
      mtime,
    });
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }
}

function emptyVault(): MemoryVaultFs {
  return new MemoryVaultFs(false);
}

describe("движок синхронизации", () => {
  let local: MemoryVaultFs;
  let remote: FakeRemote;
  let engine: SyncEngine;

  beforeEach(async () => {
    local = emptyVault();
    remote = new FakeRemote();
    engine = new SyncEngine(local);
    await engine.setAdapter(remote);
  });

  it("отправляет новые локальные заметки", async () => {
    await local.writeText("Заметка.md", "# Привет");
    const report = await engine.syncAll();
    expect(report?.pushed).toEqual(["Заметка.md"]);
    expect(remote.files.get("Заметка.md")?.content).toBe("# Привет");
  });

  it("забирает заметки, которых нет на устройстве", async () => {
    remote.files.set("Из облака.md", { content: "текст", mtime: Date.now() });
    const report = await engine.syncAll();
    expect(report?.pulled).toEqual(["Из облака.md"]);
    expect(await local.readText("Из облака.md")).toBe("текст");
  });

  it("сливает правки с двух сторон, если они не пересеклись", async () => {
    await local.writeText("a.md", "строка 1\nстрока 2\nстрока 3");
    await engine.syncAll();

    await local.writeText("a.md", "строка 1 (ПК)\nстрока 2\nстрока 3");
    remote.files.set("a.md", { content: "строка 1\nстрока 2\nстрока 3 (телефон)", mtime: Date.now() });

    const report = await engine.syncAll();
    expect(report?.merged).toEqual(["a.md"]);
    expect(await local.readText("a.md")).toBe("строка 1 (ПК)\nстрока 2\nстрока 3 (телефон)");
    expect(remote.files.get("a.md")?.content).toBe("строка 1 (ПК)\nстрока 2\nстрока 3 (телефон)");
  });

  it("при пересечении правок сохраняет обе версии", async () => {
    await local.writeText("b.md", "общее начало");
    await engine.syncAll();

    await local.writeText("b.md", "правка с ПК");
    remote.files.set("b.md", { content: "правка с телефона", mtime: Date.now() });

    const report = await engine.syncAll();
    expect(report?.conflicted).toHaveLength(1);
    expect(await local.readText("b.md")).toBe("правка с ПК");
    const copy = report!.conflicted[0];
    expect(copy).toMatch(/b \(Conflict .+\)\.md/);
    expect(await local.readText(copy)).toBe("правка с телефона");
  });

  it("направление «забрать» не отправляет локальные правки", async () => {
    await local.writeText("c.md", "версия устройства");
    remote.files.set("c.md", { content: "версия хранилища", mtime: Date.now() });

    await engine.syncAll({ direction: "pull" });
    expect(await local.readText("c.md")).toBe("версия хранилища");
    expect(remote.files.get("c.md")?.content).toBe("версия хранилища");
  });

  it("направление «отправить» перезаписывает хранилище", async () => {
    await local.writeText("d.md", "версия устройства");
    remote.files.set("d.md", { content: "версия хранилища", mtime: Date.now() });

    await engine.syncAll({ direction: "push" });
    expect(remote.files.get("d.md")?.content).toBe("версия устройства");
    expect(await local.readText("d.md")).toBe("версия устройства");
  });

  it("политика «оставить своё» не трогает локальный файл", async () => {
    await local.writeText("e.md", "база");
    await engine.syncAll();
    await local.writeText("e.md", "моё");
    remote.files.set("e.md", { content: "чужое", mtime: Date.now() });

    const report = await engine.syncAll({ conflict: "keep-local" });
    expect(report?.conflicted).toEqual([]);
    expect(await local.readText("e.md")).toBe("моё");
    expect(remote.files.get("e.md")?.content).toBe("моё");
  });

  it("удаление в хранилище повторяется на устройстве", async () => {
    await local.writeText("f.md", "текст");
    await engine.syncAll();
    remote.files.delete("f.md");

    const report = await engine.syncAll();
    expect(report?.deletedLocal).toEqual(["f.md"]);
    expect(await local.exists("f.md")).toBe(false);
  });

  it("правки офлайн копятся в очереди и уходят при следующей сверке", async () => {
    await engine.setAdapter(null);
    await local.writeText("g.md", "написано офлайн");
    engine.notifyLocalChange("g.md");
    expect(engine.getState().pending).toBe(1);

    await engine.setAdapter(remote);
    await engine.flush();
    expect(remote.files.get("g.md")?.content).toBe("написано офлайн");
    expect(engine.getState().pending).toBe(0);
  });
});
