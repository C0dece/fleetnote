/**
 * Шаг сборки: достаёт ключи OAuth-клиента Google из секретов репозитория
 * и отдаёт их Vite, чтобы в готовом приложении вход работал одной кнопкой.
 *
 * Имя секрета легко написать иначе, поэтому проверяем несколько привычных
 * вариантов. Значения не печатаются и никуда не сохраняются: в отчёт идут
 * только имена секретов, длины и факт находки.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { extractGoogleClient } from "./google-client.mjs";

/** Имена секретов, в которых ищем файл клиента из консоли Google. */
const ИМЕНА = [
  "GDRIVE_CLIENT_JSON",
  "DESKTOPCLIENT",
  "DESKTOP_CLIENT",
  "DESKTOPCLIENT_JSON",
  "GOOGLE_CLIENT_JSON",
  "GOOGLE_CLIENT",
  "GDRIVE_CLIENT",
];

const заполненные = ИМЕНА.filter((имя) => (process.env[имя] ?? "").trim().length > 0);
const имяСекрета = заполненные[0] ?? null;
const сырой = имяСекрета ? process.env[имяСекрета].trim() : "";

const { id, secret, source, error } = extractGoogleClient({
  json: сырой,
  id: process.env.GDRIVE_CLIENT_ID ?? "",
  secret: process.env.GDRIVE_CLIENT_SECRET ?? "",
});

for (const value of [id, secret]) if (value) console.log(`::add-mask::${value}`);

const envFile = process.env.GITHUB_ENV;
if (envFile) {
  appendFileSync(envFile, `VITE_GDRIVE_CLIENT_ID=${id}\nVITE_GDRIVE_CLIENT_SECRET=${secret}\n`);
}

const info = {
  имяСекрета,
  проверенныеИмена: ИМЕНА,
  секретПередан: сырой.length > 0,
  длинаСекрета: сырой.length,
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
