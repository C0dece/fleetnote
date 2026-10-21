import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Tauri sets TAURI_DEV_HOST when running `tauri android dev` / `tauri ios dev`
// so the device can reach the dev server over the LAN.
const host = process.env.TAURI_DEV_HOST;

// Сборка «всё в одном файле»: один .html, который открывается с диска двойным
// кликом, без сервера и без установки. Цель компиляции ниже обычной — такой
// файл должен открываться и в браузере, который давно не обновляли.
const singleFile = Boolean(process.env.FLEETNOTE_SINGLE_FILE);

export default defineConfig({
  // Относительные пути к ассетам: сборка одинаково работает и в Tauri,
  // и когда статика раздаётся из подкаталога (веб-демо по ссылке).
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Tauri expects a fixed port and swallows the Vite banner.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    outDir: singleFile ? "dist-single" : "dist",
    // Safari 13 / Android WebView baseline used by Tauri mobile.
    target: singleFile
      ? ["chrome87", "edge88", "firefox78", "safari14"]
      : process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "safari15",
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 100_000_000 : 4096,
    rollupOptions: singleFile ? { output: { inlineDynamicImports: true } } : undefined,
  },
});
