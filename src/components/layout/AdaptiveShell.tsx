import { useIsMobileLayout } from "@/hooks/useMediaQuery";
import { useOsFileDrop } from "@/hooks/useOsFileDrop";
import { DesktopShell } from "./DesktopShell";
import { MobileShell } from "./MobileShell";

/**
 * Единственное место, где раскладка выбирается между ПК и мобильным.
 * Всё остальное — общий код, поэтому сборка под Android/iOS не требует правок компонентов.
 */
export function AdaptiveShell() {
  const isMobile = useIsMobileLayout();
  const dropping = useOsFileDrop();

  return (
    <>
      {isMobile ? <MobileShell /> : <DesktopShell />}
      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl border-2 border-dashed border-accent bg-panel px-6 py-4 text-[15px] text-ink">
            Отпустите — файлы лягут в базу
          </div>
        </div>
      )}
    </>
  );
}
