/**
 * Разбор ключей OAuth-клиента Google.
 *
 * Консоль отдаёт файл вида `{"installed": {"client_id": …, "client_secret": …}}`,
 * но в секрет могли положить и внутренний объект, и просто пару значений —
 * поддерживаем все варианты, чтобы не заставлять пересоздавать секреты.
 */
export function extractGoogleClient({ json = "", id = "", secret = "" } = {}) {
  const result = { id: id.trim(), secret: secret.trim(), source: id || secret ? "fields" : "none" };
  const raw = (json ?? "").trim();
  if (!raw) return result;

  if (!raw.startsWith("{")) {
    // Не JSON: возможно, в секрет положили только client_id
    if (!result.id && raw.includes(".apps.googleusercontent.com")) {
      return { id: raw, secret: result.secret, source: "plain" };
    }
    return { ...result, error: "секрет не похож ни на JSON, ни на Client ID" };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...result, error: "секрет не разобрался как JSON" };
  }

  const node = parsed.installed ?? parsed.web ?? parsed;
  const parsedId = String(node.client_id ?? "").trim();
  const parsedSecret = String(node.client_secret ?? "").trim();

  return {
    id: parsedId || result.id,
    secret: parsedSecret || result.secret,
    source: "json",
    ...(parsedId ? {} : { error: "в JSON нет client_id" }),
  };
}
