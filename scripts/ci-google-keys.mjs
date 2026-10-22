/**
 * Шаг сборки: достаёт ключи Google из секретов и отдаёт их Vite.
 * Значения не печатаются и не сохраняются — только длины и факт наличия,
 * чтобы по сборке можно было понять, что пошло не так.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { extractGoogleClient } from "./google-client.mjs";

const rawSecret = process.env.GDRIVE_CLIENT_JSON ?? process.env.DESKTOPCLIENT ?? "";
const { id, secret, source, error } = extractGoogleClient({
  json: rawSecret,
  id: process.env.GDRIVE_CLIENT_ID ?? "",
  secret: process.env.GDRIVE_CLIENT_SECRET ?? "",
});

for (const value of [id, secret]) if (value) console.log(`::add-mask::${value}`);

const envFile = process.env.GITHUB_ENV;
if (envFile) {
  appendFileSync(envFile, `VITE_GDRIVE_CLIENT_ID=${id}\nVITE_GDRIVE_CLIENT_SECRET=${secret}\n`);
}

const info = {
  секретПередан: rawSecret.length > 0,
  длинаСекрета: rawSecret.length,
  откудаВзято: source,
  clientIdНайден: Boolean(id),
  длинаClientId: id.length,
  clientSecretНайден: Boolean(secret),
  длинаClientSecret: secret.length,
  ошибка: error ?? null,
};
writeFileSync("build-info.json", `${JSON.stringify(info, null, 2)}\n`, "utf8");

console.log(JSON.stringify(info));
console.log(
  id
    ? "Client ID найден — вход будет работать одной кнопкой"
    : "Client ID не найден: приложение попросит свой",
);
