import { describe, expect, it } from "vitest";
// @ts-expect-error — скрипт сборки на чистом JS, типов у него нет
import { extractGoogleClient } from "../../../scripts/google-client.mjs";

describe("разбор ключей Google из секрета", () => {
  const id = "123-abc.apps.googleusercontent.com";
  const secret = "GOCSPX-пример";

  it("понимает файл из консоли целиком", () => {
    const json = JSON.stringify({
      installed: {
        client_id: id,
        project_id: "fleetnote",
        client_secret: secret,
        redirect_uris: ["http://localhost"],
      },
    });
    expect(extractGoogleClient({ json })).toMatchObject({ id, secret, source: "json" });
  });

  it("понимает внутренности файла без обёртки", () => {
    const json = JSON.stringify({ client_id: id, client_secret: secret });
    expect(extractGoogleClient({ json })).toMatchObject({ id, secret });
  });

  it("понимает клиент типа web", () => {
    const json = JSON.stringify({ web: { client_id: id, client_secret: secret } });
    expect(extractGoogleClient({ json })).toMatchObject({ id, secret });
  });

  it("принимает отдельные значения, если JSON не задан", () => {
    expect(extractGoogleClient({ id, secret })).toMatchObject({ id, secret, source: "fields" });
  });

  it("принимает голый Client ID", () => {
    expect(extractGoogleClient({ json: id })).toMatchObject({ id, source: "plain" });
  });

  it("сообщает о неразобранном секрете, не падая", () => {
    expect(extractGoogleClient({ json: "{не json" }).error).toBe("секрет не разобрался как JSON");
    expect(extractGoogleClient({ json: "мусор" }).error).toContain("не похож");
  });

  it("без секретов возвращает пустые значения", () => {
    expect(extractGoogleClient()).toMatchObject({ id: "", secret: "", source: "none" });
  });
});
