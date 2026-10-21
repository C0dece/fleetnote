import { AlertTriangle, CloudOff, Cloud, RefreshCw, Check } from "lucide-react";
import { useSyncStore } from "@/stores/syncStore";
import { useUIStore } from "@/stores/uiStore";

/** Индикатор синхронизации: один взгляд — и понятно, дошли ли правки до облака. */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const status = useSyncStore((state) => state.status);
  const syncNow = useSyncStore((state) => state.syncNow);
  const setSettings = useUIStore((state) => state.setSettings);

  const { icon, text, tone } = describe(status.status, status.pending);

  return (
    <button
      type="button"
      onClick={() => (status.status === "off" ? setSettings(true) : void syncNow())}
      title={status.message ?? text}
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] hover:bg-hover ${tone}`}
    >
      {icon}
      {!compact && <span className="max-w-40 truncate">{status.message ?? text}</span>}
      {status.pending > 0 && <span className="tabular-nums">{status.pending}</span>}
    </button>
  );
}

function describe(status: string, pending: number): { icon: React.ReactNode; text: string; tone: string } {
  switch (status) {
    case "syncing":
      return {
        icon: <RefreshCw size={13} className="animate-spin" />,
        text: "Синхронизация…",
        tone: "text-muted",
      };
    case "offline":
      return { icon: <CloudOff size={13} />, text: `Офлайн · в очереди ${pending}`, tone: "text-warn" };
    case "error":
      return { icon: <AlertTriangle size={13} />, text: "Ошибка синхронизации", tone: "text-danger" };
    case "idle":
      return pending > 0
        ? { icon: <Cloud size={13} />, text: "Ожидает отправки", tone: "text-muted" }
        : { icon: <Check size={13} />, text: "Синхронизировано", tone: "text-ok" };
    default:
      return { icon: <CloudOff size={13} />, text: "Облако не подключено", tone: "text-muted" };
  }
}
