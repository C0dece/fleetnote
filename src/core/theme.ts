import type { AppearanceSettings, ThemeName } from "@/stores/settingsStore";

/** Какой теме соответствует «системная» прямо сейчас. */
export function resolveTheme(theme: ThemeName): Exclude<ThemeName, "system"> {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const BACKGROUND: Record<Exclude<ThemeName, "system">, string> = {
  light: "#FAF8F5",
  dark: "#0D0F12",
  amoled: "#000000",
};

/**
 * Единственное место, где оформление превращается в CSS-переменные.
 * Благодаря этому смена темы, шрифта или ширины колонки не перерисовывает дерево React.
 */
export function applyAppearance(appearance: AppearanceSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = resolveTheme(appearance.theme);

  root.dataset.theme = theme;
  root.style.colorScheme = theme === "light" ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BACKGROUND[theme]);

  const vars: Record<string, string> = {
    "--fn-accent": appearance.accent,
    "--fn-accent-soft": hexToRgba(appearance.accent, theme === "light" ? 0.12 : 0.16),
    "--fn-accent-soft-ink":
      theme === "light" ? shade(appearance.accent, -0.2) : shade(appearance.accent, 0.35),
    "--fn-selection": hexToRgba(appearance.accent, theme === "light" ? 0.18 : 0.28),
    "--fn-font-sans": appearance.fontSans,
    "--fn-font-mono": appearance.fontMono,
    "--fn-editor-font-size": `${appearance.fontSize}px`,
    "--fn-editor-line-height": String(appearance.lineHeight),
    "--fn-measure": appearance.fullWidth ? "none" : `${appearance.measure}ch`,
    "--fn-ui-scale": String(appearance.uiScale),
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgb(${r} ${g} ${b} / ${Math.round(alpha * 100)}%)`;
}

/** Осветлить (amount > 0) или затемнить (amount < 0) цвет. */
function shade(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const mix = (channel: number) =>
    Math.round(amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount));
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean.padEnd(6, "0");
  return {
    r: Number.parseInt(full.slice(0, 2), 16) || 0,
    g: Number.parseInt(full.slice(2, 4), 16) || 0,
    b: Number.parseInt(full.slice(4, 6), 16) || 0,
  };
}
