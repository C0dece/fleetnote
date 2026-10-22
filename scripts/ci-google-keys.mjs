/**
 * Шаг сборки: достаёт ключи Google из секретов и отдаёт их Vite.
 * Значения не печатаются — только то, нашлись они или нет.
 */
import { appendFileSync } from "node:fs";
import { extractGoogleClient } from "./google-client.mjs";

const { id, secret, error } = extractGoogleClient({
  json: process.env.GDRIVE_CLIENT_JSON ?? process.env.DESKTOPCLIENT ?? "",
  id: process.env.GDRIVE_CLIENT_ID ?? "",
  secret: process.env.GDRIVE_CLIENT_SECRET ?? "",
});

if (error) console.log(`Ключи Google: ${error}`);

// Прячем значения в логах GitHub на случай, если их где-то выведут
for (const value of [id, secret]) if (value) console.log(`::add-mask::${value}`);

const envFile = process.env.GITHUB_ENV;
if (envFile) {
  appendFileSync(envFile, `VITE_GDRIVE_CLIENT_ID=${id}\nVITE_GDRIVE_CLIENT_SECRET=${secret}\n`);
}

console.log(
  id
    ? "Client ID найден — вход будет работать одной кнопкой"
    : "Client ID не найден: приложение попросит свой",
);
console.log(secret ? "Client secret найден" : "Client secret не найден");
