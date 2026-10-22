/**
 * Разбор ключей OAuth-клиента Google из секрета сборки.
 *
 * Консоль отдаёт файл вида `{"installed": {"client_id": …, "client_secret": …}}`,
 * но в секрет могли положить что угодно: внутренний объект, пару строк без скобок,
 * просто два значения. Разбираем все варианты — пересоздавать секрет не должно
 * быть нужно из-за формата.
 */
export function extractGoogleClient({ json = "", id = "", secret = "" } = {}) {
  const fallback = { id: (id ?? "").trim(), secret: (secret ?? "").trim() };
  const raw = (json ?? "").trim();
  if (!raw) {
    return { ...fallback, source: fallback.id || fallback.secret ? "fields" : "none" };
  }

  // 1. Обычный JSON целиком
  const direct = fromJson(raw);
  if (direct) return { ...merge(direct, fallback), source: "json" };

  // 2. Вставили внутренности без внешних скобок
  const wrapped = fromJson(`{${raw}}`);
  if (wrapped) return { ...merge(wrapped, fallback), source: "json-fragment" };

  // 3. Голый Client ID
  if (/^[\w.-]+\.apps\.googleusercontent\.com$/.test(raw)) {
    return { id: raw, secret: fallback.secret, source: "plain" };
  }

  // 4. Любой текст, в котором встречаются нужные значения
  const scanned = fromText(raw);
  if (scanned.id || scanned.secret) return { ...merge(scanned, fallback), source: "text" };

  return { ...fallback, source: "unparsed", error: "в секрете не нашлось client_id" };
}

function merge(found, fallback) {
  return { id: found.id || fallback.id, secret: found.secret || fallback.secret };
}

function fromJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const node = parsed.installed ?? parsed.web ?? parsed;
  return {
    id: String(node.client_id ?? "").trim(),
    secret: String(node.client_secret ?? "").trim(),
  };
}

/** Последняя попытка: выдёргиваем значения регулярками из произвольного текста. */
function fromText(raw) {
  const id =
    /client_id["'\s:=]+([\w.-]+\.apps\.googleusercontent\.com)/i.exec(raw)?.[1] ??
    /([\w-]+\.apps\.googleusercontent\.com)/i.exec(raw)?.[1] ??
    "";
  const secret =
    /client_secret["'\s:=]+([^\s"',}]{6,})/i.exec(raw)?.[1] ?? /(GOCSPX-[^\s"',}]+)/.exec(raw)?.[1] ?? "";
  return { id: id.trim(), secret: secret.trim() };
}
