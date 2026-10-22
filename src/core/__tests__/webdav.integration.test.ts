import { beforeAll, describe, expect, it } from "vitest";
import { MemoryVaultFs } from "../fs/memoryFs";
import { SyncEngine } from "../sync/syncEngine";
import { WebDavAdapter } from "../sync/adapters/webdav";

/**
 * Проверка на живом WebDAV-сервере.
 * Поднять локально: `wsgidav --host=127.0.0.1 --port=8099 --root=/tmp/dav-root --auth=anonymous`
 * и запустить тесты с `FLEETNOTE_WEBDAV_URL=http://127.0.0.1:8099`.
 * Без переменной набор пропускается, чтобы обычный прогон не зависел от сети.
 */
const url = process.env.FLEETNOTE_WEBDAV_URL;
const suite = url ? describe : describe.skip;

suite("синхронизация с живым WebDAV", () => {
  const base = `fleetnote-test-${Date.now().toString(36)}`;
  let adapter: WebDavAdapter;

  beforeAll(async () => {
    adapter = new WebDavAdapter();
    await adapter.connect({
      url: url as string,
      username: process.env.FLEETNOTE_WEBDAV_USER ?? "",
      password: process.env.FLEETNOTE_WEBDAV_PASSWORD ?? "",
      path: base,
    });
  });

  it("кладёт файл на сервер и читает его обратно", async () => {
    await adapter.writeFile("Заметка.md", "# Привет с устройства");
    const listed = await adapter.listFiles();
    expect(listed.map((item) => item.path)).toContain("Заметка.md");
    expect(await adapter.readFile("Заметка.md")).toBe("# Привет с устройства");
  });

  it("создаёт вложенные папки под заметки", async () => {
    await adapter.writeFile("Проекты/Альфа/План.md", "- [ ] запустить");
    expect(await adapter.readFile("Проекты/Альфа/План.md")).toBe("- [ ] запустить");
    const listed = await adapter.listFiles();
    expect(listed.map((item) => item.path)).toContain("Проекты/Альфа/План.md");
  });

  it("полный цикл движка: отправка, получение на второе устройство, слияние", async () => {
    const phone = new MemoryVaultFs(false);
    const laptop = new MemoryVaultFs(false);

    const phoneEngine = new SyncEngine(phone);
    const laptopEngine = new SyncEngine(laptop);
    const phoneAdapter = new WebDavAdapter();
    const laptopAdapter = new WebDavAdapter();
    const config = {
      url: url as string,
      username: process.env.FLEETNOTE_WEBDAV_USER ?? "",
      password: process.env.FLEETNOTE_WEBDAV_PASSWORD ?? "",
      path: `${base}/двое`,
    };
    await phoneAdapter.connect(config);
    await laptopAdapter.connect(config);
    await phoneEngine.setAdapter(phoneAdapter);
    await laptopEngine.setAdapter(laptopAdapter);

    // телефон создаёт заметку
    await phone.writeText("Общая.md", "строка 1\nстрока 2\nстрока 3");
    await phoneEngine.syncAll();

    // ноутбук забирает её
    await laptopEngine.syncAll();
    expect(await laptop.readText("Общая.md")).toBe("строка 1\nстрока 2\nстрока 3");

    // правки с двух сторон в разных местах файла сливаются без потерь
    await phone.writeText("Общая.md", "строка 1 (телефон)\nстрока 2\nстрока 3");
    await phoneEngine.syncAll();
    await laptop.writeText("Общая.md", "строка 1\nстрока 2\nстрока 3 (ноутбук)");
    const report = await laptopEngine.syncAll();

    expect(report?.merged).toEqual(["Общая.md"]);
    expect(await laptop.readText("Общая.md")).toBe("строка 1 (телефон)\nстрока 2\nстрока 3 (ноутбук)");

    await phoneEngine.syncAll();
    expect(await phone.readText("Общая.md")).toBe("строка 1 (телефон)\nстрока 2\nстрока 3 (ноутбук)");
  });

  it("удаление доходит до второго устройства", async () => {
    const phone = new MemoryVaultFs(false);
    const laptop = new MemoryVaultFs(false);
    const config = {
      url: url as string,
      username: process.env.FLEETNOTE_WEBDAV_USER ?? "",
      password: process.env.FLEETNOTE_WEBDAV_PASSWORD ?? "",
      path: `${base}/удаление`,
    };
    const phoneEngine = new SyncEngine(phone);
    const laptopEngine = new SyncEngine(laptop);
    const first = new WebDavAdapter();
    const second = new WebDavAdapter();
    await first.connect(config);
    await second.connect(config);
    await phoneEngine.setAdapter(first);
    await laptopEngine.setAdapter(second);

    await phone.writeText("Временная.md", "черновик");
    await phoneEngine.syncAll();
    await laptopEngine.syncAll();
    expect(await laptop.exists("Временная.md")).toBe(true);

    await phone.remove("Временная.md");
    await phoneEngine.syncAll();
    const report = await laptopEngine.syncAll();

    expect(report?.deletedLocal).toEqual(["Временная.md"]);
    expect(await laptop.exists("Временная.md")).toBe(false);
  });
});
