/** Специальные вкладки, которые показывают не заметку, а отдельный вид. */
export const GRAPH_TAB = "fleetnote:graph";

export function isGraphTab(path: string): boolean {
  return path === GRAPH_TAB;
}

export function isCanvasTab(path: string): boolean {
  return path.toLowerCase().endsWith(".canvas");
}

export function isSpecialTab(path: string): boolean {
  return isGraphTab(path) || isCanvasTab(path);
}

/** Подпись вкладки для специальных видов. */
export function specialTabTitle(path: string): string | null {
  if (isGraphTab(path)) return "Граф базы";
  if (isCanvasTab(path)) return (path.split("/").pop() ?? path).replace(/\.canvas$/i, "");
  return null;
}
