import type { ReactNode } from "react";

export function IconButton({
  title,
  onClick,
  children,
  active,
  className = "",
}: {
  title: string;
  onClick(): void;
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink ${
        active ? "bg-accent-soft text-ink" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}
