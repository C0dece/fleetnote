import { useIsMobileLayout } from "@/hooks/useMediaQuery";
import { DesktopShell } from "./DesktopShell";
import { MobileShell } from "./MobileShell";

/**
 * Единственное место, где раскладка выбирается между ПК и мобильным.
 * Всё остальное — общий код, поэтому сборка под Android/iOS не требует правок компонентов.
 */
export function AdaptiveShell() {
  return useIsMobileLayout() ? <MobileShell /> : <DesktopShell />;
}
