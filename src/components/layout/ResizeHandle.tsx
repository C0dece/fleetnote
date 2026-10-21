import { useCallback } from "react";

/** Вертикальный разделитель панелей: тянется мышью, работает и с клавиатуры. */
export function ResizeHandle({
  onResize,
  side,
  width,
}: {
  onResize(width: number): void;
  side: "left" | "right";
  width: number;
}) {
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;
      const move = (move: PointerEvent) => {
        const delta = move.clientX - startX;
        onResize(side === "left" ? startWidth + delta : startWidth - delta);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.cursor = "";
      };
      document.body.style.cursor = "col-resize";
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onResize, side, width],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") onResize(width + (side === "left" ? -16 : 16));
        if (event.key === "ArrowRight") onResize(width + (side === "left" ? 16 : -16));
      }}
      className="group relative w-px shrink-0 cursor-col-resize bg-[var(--fn-hairline)]"
    >
      <div className="absolute -left-1 top-0 h-full w-2 group-hover:bg-accent-soft" />
    </div>
  );
}
