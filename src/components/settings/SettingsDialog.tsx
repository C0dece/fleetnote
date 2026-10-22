import { useState } from "react";
import { Cloud, FileText, Info, Palette, Smartphone, X } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useIsMobileLayout } from "@/hooks/useMediaQuery";
import { AppearanceSection } from "./sections/AppearanceSection";
import { EditorSection } from "./sections/EditorSection";
import { VaultSection } from "./sections/VaultSection";
import { SyncSection } from "./sections/SyncSection";
import { MobileSection } from "./sections/MobileSection";
import { AboutSection } from "./sections/AboutSection";

const SECTIONS = [
  { id: "appearance", label: "Вид", icon: <Palette size={15} />, render: () => <AppearanceSection /> },
  { id: "editor", label: "Редактор", icon: <FileText size={15} />, render: () => <EditorSection /> },
  { id: "vault", label: "Хранилище", icon: <FileText size={15} />, render: () => <VaultSection /> },
  { id: "sync", label: "Синхронизация", icon: <Cloud size={15} />, render: () => <SyncSection /> },
  { id: "mobile", label: "Мобильные", icon: <Smartphone size={15} />, render: () => <MobileSection /> },
  { id: "about", label: "О программе", icon: <Info size={15} />, render: () => <AboutSection /> },
];

/** Настройки: слева разделы, справа содержимое. На телефоне — список и экран раздела. */
export function SettingsDialog() {
  const open = useUIStore((state) => state.settings);
  const section = useUIStore((state) => state.settingsSection);
  const setSettings = useUIStore((state) => state.setSettings);
  const isMobile = useIsMobileLayout();
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    setSettings(false);
    setMobileOpen(null);
  };
  const current = SECTIONS.find((item) => item.id === (isMobile ? mobileOpen : section));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="flex h-full w-full flex-col overflow-hidden border bg-panel hairline panel-shadow sm:h-[82vh] sm:max-w-3xl sm:rounded-2xl">
        <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5 hairline pt-safe">
          {isMobile && mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(null)}
              className="touch-row rounded-lg px-2 text-[14px] text-muted hover:bg-hover"
            >
              Назад
            </button>
          )}
          <h2 className="flex-1 text-[16px] font-semibold text-ink">
            {isMobile && current ? current.label : "Настройки"}
          </h2>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={close}
            className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-hover"
          >
            <X size={17} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {(!isMobile || !mobileOpen) && (
            <nav
              className={`flex shrink-0 flex-col gap-0.5 overflow-y-auto p-2 ${
                isMobile ? "w-full" : "w-48 border-r hairline"
              }`}
            >
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (isMobile ? setMobileOpen(item.id) : setSettings(true, item.id))}
                  className={`flex touch-row items-center gap-2 rounded-lg px-2.5 text-left text-[14px] ${
                    !isMobile && section === item.id ? "bg-accent-soft text-ink" : "text-muted hover:bg-hover"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          {(!isMobile || mobileOpen) && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 pb-safe">{current?.render()}</div>
          )}
        </div>
      </div>
    </div>
  );
}
