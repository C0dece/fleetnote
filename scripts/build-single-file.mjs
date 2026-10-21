/**
 * Склеивает сборку из dist-single в один самодостаточный fleetnote.html:
 * скрипты и стили переносятся внутрь документа, внешних запросов не остаётся.
 * Нужен для запуска с диска, когда ни сервера, ни тулчейна под рукой нет.
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "dist-single");
let html = readFileSync(join(dir, "index.html"), "utf8");

const read = (src) => readFileSync(join(dir, src.replace(/^\.?\//, "")), "utf8");

html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (_match, src) => {
  const code = read(src).replace(/<\/script>/gi, "<\\/script>");
  return `<script type="module">\n${code}\n</script>`;
});

html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_match, href) => {
  return `<style>\n${read(href)}\n</style>`;
});

// Иконка вкладки — тоже внутрь, чтобы файл не искал соседей на диске
html = html.replace(/<link[^>]*rel="icon"[^>]*href="([^"]+)"[^>]*>/g, (_match, href) => {
  const svg = read(href);
  const encoded = Buffer.from(svg, "utf8").toString("base64");
  return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${encoded}" />`;
});

const out = join(dir, "fleetnote.html");
writeFileSync(out, html, "utf8");
rmSync(join(dir, "index.html"), { force: true });
console.log(`${out} — ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} МБ`);
