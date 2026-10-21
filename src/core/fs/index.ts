export type { VaultEntry, VaultFs } from "./types";
export * as paths from "./paths";
export { MemoryVaultFs } from "./memoryFs";
export { TauriVaultFs } from "./tauriFs";

/** Запущены ли мы внутри Tauri (а не в обычном браузере). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
