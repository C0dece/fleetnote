/** Свойства заметки: YAML-блок в начале файла, как в Obsidian. */

export type PropertyType = "text" | "number" | "date" | "checkbox" | "list";

export interface Property {
  key: string;
  type: PropertyType;
  value: string | number | boolean | string[];
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseProperties(text: string): { properties: Property[]; body: string } {
  const match = FENCE.exec(text);
  if (!match) return { properties: [], body: text };

  const properties: Property[] = [];
  const lines = match[1].split(/\r?\n/);
  let current: Property | null = null;

  for (const line of lines) {
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem && current) {
      // Поле становится списком, как только под ним появляется первый пункт
      const property: Property =
        current.type === "list" ? current : { key: current.key, type: "list", value: [] };
      (property.value as string[]).push(unquote(listItem[1]));
      current = property;
      continue;
    }
    const pair = /^([^:#][^:]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    if (current) properties.push(current);
    const key = pair[1].trim();
    const raw = pair[2].trim();
    current = { key, ...inferValue(raw) };
  }
  if (current) properties.push(current);

  return { properties, body: text.slice(match[0].length) };
}

function inferValue(raw: string): { type: PropertyType; value: Property["value"] } {
  if (raw === "") return { type: "text", value: "" };
  if (raw === "true" || raw === "false") return { type: "checkbox", value: raw === "true" };
  if (/^\[.*\]$/.test(raw)) {
    const items = raw
      .slice(1, -1)
      .split(",")
      .map((item) => unquote(item.trim()))
      .filter(Boolean);
    return { type: "list", value: items };
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { type: "number", value: Number(raw) };
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?$/.test(raw)) return { type: "date", value: raw };
  return { type: "text", value: unquote(raw) };
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

export function stringifyProperties(properties: Property[], body: string): string {
  if (properties.length === 0) return body.replace(/^\s*\n/, "");
  const lines = properties.map((property) => {
    if (property.type === "list") {
      const items = (property.value as string[]).filter((item) => item !== "");
      if (items.length === 0) return `${property.key}:`;
      return `${property.key}:\n${items.map((item) => `  - ${item}`).join("\n")}`;
    }
    if (property.type === "checkbox") return `${property.key}: ${property.value ? "true" : "false"}`;
    return `${property.key}: ${String(property.value)}`;
  });
  return `---\n${lines.join("\n")}\n---\n${body.startsWith("\n") ? body.slice(1) : body}`;
}

export function emptyValue(type: PropertyType): Property["value"] {
  switch (type) {
    case "number":
      return 0;
    case "checkbox":
      return false;
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "list":
      return [];
    default:
      return "";
  }
}
