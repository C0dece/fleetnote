import { useEffect, useRef, useState } from "react";
import { create } from "zustand";

type Request =
  | {
      kind: "prompt";
      title: string;
      value: string;
      placeholder?: string;
      confirmLabel?: string;
      resolve(value: string | null): void;
    }
  | {
      kind: "confirm";
      title: string;
      message?: string;
      danger?: boolean;
      confirmLabel?: string;
      resolve(value: boolean): void;
    };

interface DialogState {
  request: Request | null;
  prompt(options: {
    title: string;
    value?: string;
    placeholder?: string;
    confirmLabel?: string;
  }): Promise<string | null>;
  confirm(options: {
    title: string;
    message?: string;
    danger?: boolean;
    confirmLabel?: string;
  }): Promise<boolean>;
  close(): void;
}

/** Нативные `prompt`/`confirm` в WebView не работают — держим свои. */
export const useDialogStore = create<DialogState>((set) => ({
  request: null,
  prompt: (options) =>
    new Promise((resolve) => {
      set({
        request: {
          kind: "prompt",
          title: options.title,
          value: options.value ?? "",
          placeholder: options.placeholder,
          confirmLabel: options.confirmLabel,
          resolve,
        },
      });
    }),
  confirm: (options) =>
    new Promise((resolve) => {
      set({
        request: {
          kind: "confirm",
          title: options.title,
          message: options.message,
          danger: options.danger,
          confirmLabel: options.confirmLabel,
          resolve,
        },
      });
    }),
  close: () => set({ request: null }),
}));

export function Dialogs() {
  const request = useDialogStore((state) => state.request);
  const close = useDialogStore((state) => state.close);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (request?.kind === "prompt") {
      setValue(request.value);
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
    }
  }, [request]);

  if (!request) return null;

  const cancel = () => {
    if (request.kind === "prompt") request.resolve(null);
    else request.resolve(false);
    close();
  };

  const submit = () => {
    if (request.kind === "prompt") request.resolve(value.trim() ? value.trim() : null);
    else request.resolve(true);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border bg-panel p-4 hairline panel-shadow">
        <h2 className="text-[15px] font-semibold text-ink">{request.title}</h2>
        {request.kind === "confirm" && request.message && (
          <p className="mt-1.5 text-sm text-muted">{request.message}</p>
        )}
        {request.kind === "prompt" && (
          <input
            ref={input}
            value={value}
            placeholder={request.placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
              if (event.key === "Escape") cancel();
            }}
            className="mt-3 w-full rounded-lg border bg-canvas px-3 py-2 text-[15px] text-ink outline-none hairline focus:border-accent"
          />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className="touch-row rounded-lg px-3 text-sm text-muted hover:bg-hover"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            className={`touch-row rounded-lg px-3 text-sm font-medium text-white ${
              request.kind === "confirm" && request.danger ? "bg-danger" : "bg-accent"
            }`}
          >
            {request.confirmLabel ?? (request.kind === "confirm" ? "Удалить" : "Готово")}
          </button>
        </div>
      </div>
    </div>
  );
}
