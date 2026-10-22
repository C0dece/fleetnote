import type { ReactNode } from "react";

/** Строка настройки: подпись слева, управление справа, пояснение под подписью. */
export function Row({
  label,
  hint,
  children,
  stacked,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 border-b py-3 last:border-b-0 hairline ${
        stacked ? "flex-col" : "flex-wrap items-center justify-between"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{hint}</div>}
      </div>
      <div className={stacked ? "w-full" : "shrink-0"}>{children}</div>
    </div>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange(next: boolean): void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        value ? "bg-accent" : "bg-[var(--fn-panel-2)] border hairline"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
          value ? "translate-x-5.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange(next: number): void;
}) {
  return (
    <div className="flex w-56 max-w-full items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-6 flex-1 accent-[var(--fn-accent)]"
      />
      <span className="w-14 shrink-0 text-right text-[13px] tabular-nums text-ink">
        {value}
        {unit ?? ""}
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange(next: T): void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border p-1 hairline">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-2.5 py-1.5 text-[13px] ${
            value === option.value ? "bg-accent text-white" : "text-muted hover:bg-hover hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange(next: T): void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="min-w-44 rounded-lg border bg-canvas px-2.5 py-2 text-[14px] text-ink outline-none hairline focus:border-accent"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  wide,
}: {
  value: string;
  onChange(next: string): void;
  placeholder?: string;
  type?: "text" | "password";
  wide?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-lg border bg-canvas px-3 py-2 text-[14px] text-ink outline-none hairline focus:border-accent ${
        wide ? "w-full" : "w-56 max-w-full"
      }`}
    />
  );
}

const ACCENTS = ["#6366F1", "#2563EB", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6"];

export function ColorField({ value, onChange }: { value: string; onChange(next: string): void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ACCENTS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          onClick={() => onChange(color)}
          style={{ background: color }}
          className={`size-6 rounded-full ring-offset-2 ring-offset-[var(--fn-panel)] ${
            value.toLowerCase() === color.toLowerCase() ? "ring-2 ring-[var(--fn-ink)]" : ""
          }`}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="size-7 cursor-pointer rounded border bg-transparent hairline"
        aria-label="Свой цвет"
      />
    </div>
  );
}

/** Выбор нескольких значений с сохранением порядка нажатий. */
export function ChipsField({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: Array<{ value: string; label: string }>;
  onChange(next: string[]): void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              onChange(active ? value.filter((item) => item !== option.value) : [...value, option.value])
            }
            className={`rounded-full border px-2.5 py-1 text-[12.5px] hairline ${
              active ? "bg-accent text-white" : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
