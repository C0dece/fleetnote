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
    expect(extractGoogleClient({ json: "{не json" }).error).toContain("client_id");
    expect(extractGoogleClient({ json: "мусор" })).toMatchObject({ id: "", source: "unparsed" });
  });

  it("без секретов возвращает пустые значения", () => {
    expect(extractGoogleClient()).toMatchObject({ id: "", secret: "", source: "none" });
  });
});

describe("секрет в испорченной форме", () => {
  const id = "123-abc.apps.googleusercontent.com";
  const secret = "GOCSPX-пример";

  it("понимает внутренности JSON без внешних скобок", () => {
    const raw = `"client_id":"${id}","client_secret":"${secret}"`;
    expect(extractGoogleClient({ json: raw })).toMatchObject({ id, secret, source: "json-fragment" });
  });

  it("понимает вложенный блок installed без внешних скобок", () => {
    const raw = `"installed": {"client_id": "${id}", "client_secret": "${secret}"}`;
    expect(extractGoogleClient({ json: raw })).toMatchObject({ id, secret });
  });

  it("выдёргивает значения из произвольного текста", () => {
    const raw = `client_id = ${id}\nclient_secret = ${secret}\nredirect_uris: http://localhost`;
    expect(extractGoogleClient({ json: raw })).toMatchObject({ id, secret, source: "text" });
  });

  it("находит ключи даже без подписей полей", () => {
    expect(extractGoogleClient({ json: `${id} ${secret}` })).toMatchObject({ id, secret });
  });

  it("на пустом месте не выдумывает значений", () => {
    const result = extractGoogleClient({ json: "совсем не то" });
    expect(result.id).toBe("");
    expect(result.source).toBe("unparsed");
  });
});
