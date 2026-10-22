import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Cloud,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import { useSyncStore } from "@/stores/syncStore";
import { useUIStore } from "@/stores/uiStore";

/**
 * Индикатор синхронизации. Один взгляд — и понятно, дошли ли правки до хранилища,
 * один клик — и можно выбрать направление: обе стороны, только забрать, только отправить.
 */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const status = useSyncStore((state) => state.status);
  const busy = useSyncStore((state) => state.busy);
  const syncNow = useSyncStore((state) => state.syncNow);
  const profile = useSyncStore((state) => state.profile);
  const setSettings = useUIStore((state) => state.setSettings);
  const [open, setOpen] = useState(false);

  const { icon, text, tone } = describe(status.status, status.pending);
  const connected = Boolean(profile?.adapter);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (connected ? setOpen((value) => !value) : setSettings(true, "sync"))}
        title={status.message ?? text}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] hover:bg-hover ${tone}`}
      >
        {busy ? <RefreshCw size={13} className="animate-spin" /> : icon}
        {!compact && <span className="max-w-40 truncate">{status.message ?? text}</span>}
        {status.pending > 0 && <span className="tabular-nums">{status.pending}</span>}
      </button>

      {open && connected && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-50 mb-1 w-56 overflow-hidden rounded-xl border bg-panel py-1 text-[13px] hairline panel-shadow">
            <MenuItem
              icon={<RefreshCw size={14} />}
              label="Синхронизировать"
              hint="Обе стороны"
              onClick={() => {
                setOpen(false);
                void syncNow("both");
              }}
            />
            <MenuItem
              icon={<ArrowDownToLine size={14} />}
              label="Забрать из хранилища"
              hint="Хранилище важнее"
              onClick={() => {
                setOpen(false);
                void syncNow("pull");
              }}
            />
            <MenuItem
              icon={<ArrowUpFromLine size={14} />}
              label="Отправить своё"
              hint="Устройство важнее"
              onClick={() => {
                setOpen(false);
                void syncNow("push");
              }}
            />
            <div className="my-1 border-t hairline" />
            <MenuItem
              icon={<Cloud size={14} />}
              label="Настройки синхронизации"
              onClick={() => {
                setOpen(false);
                setSettings(true, "sync");
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full touch-row items-center gap-2 px-3 text-left text-ink hover:bg-hover"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
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
      return { icon: <CloudOff size={13} />, text: "Хранилище не подключено", tone: "text-muted" };
  }
}
