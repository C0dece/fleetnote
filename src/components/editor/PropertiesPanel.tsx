import { useMemo, useState } from "react";
import { Calendar, CheckSquare, Hash, List, Plus, Trash2, Type } from "lucide-react";
import {
  emptyValue,
  parseProperties,
  stringifyProperties,
  type Property,
  type PropertyType,
} from "@/core/vault/frontmatter";

const TYPE_ICONS: Record<PropertyType, React.ReactNode> = {
  text: <Type size={13} />,
  number: <Hash size={13} />,
  date: <Calendar size={13} />,
  checkbox: <CheckSquare size={13} />,
  list: <List size={13} />,
};

const TYPE_LABELS: Record<PropertyType, string> = {
  text: "Текст",
  number: "Число",
  date: "Дата",
  checkbox: "Флажок",
  list: "Список",
};

/**
 * Свойства заметки: типизированные поля из YAML-блока в начале файла.
 * Правка поля переписывает frontmatter, остальной текст не трогается.
 */
export function PropertiesPanel({ text, onChange }: { text: string; onChange(next: string): void }) {
  const { properties, body } = useMemo(() => parseProperties(text), [text]);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<PropertyType>("text");

  const commit = (next: Property[]) => onChange(stringifyProperties(next, body));

  const update = (index: number, patch: Partial<Property>) => {
    const next = properties.map((property, position) =>
      position === index ? { ...property, ...patch } : property,
    );
    commit(next);
  };

  if (properties.length === 0 && !adding) {
    return (
      <div className="px-4 pt-2">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] text-muted hover:bg-hover hover:text-ink"
        >
          <Plus size={13} /> Добавить свойство
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[var(--fn-measure)] px-4 pt-2">
      <div className="rounded-xl border bg-panel/50 p-2 hairline">
        {properties.map((property, index) => (
          <div key={`${property.key}-${index}`} className="flex items-center gap-2 py-1">
            <span className="text-muted">{TYPE_ICONS[property.type]}</span>
            <input
              value={property.key}
              onChange={(event) => update(index, { key: event.target.value })}
              className="w-32 shrink-0 bg-transparent text-[12.5px] text-muted outline-none"
            />
            <PropertyValue property={property} onChange={(value) => update(index, { value })} />
            <select
              value={property.type}
              onChange={(event) => {
                const type = event.target.value as PropertyType;
                update(index, { type, value: emptyValue(type) });
              }}
              className="shrink-0 rounded border bg-canvas px-1 py-0.5 text-[11px] text-muted outline-none hairline"
              aria-label="Тип свойства"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Удалить свойство"
              onClick={() => commit(properties.filter((_, position) => position !== index))}
              className="shrink-0 rounded p-1 text-muted hover:bg-hover hover:text-danger"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="flex items-center gap-2 border-t pt-2 hairline">
            <input
              autoFocus
              value={newKey}
              placeholder="Название поля"
              onChange={(event) => setNewKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newKey.trim()) {
                  commit([...properties, { key: newKey.trim(), type: newType, value: emptyValue(newType) }]);
                  setNewKey("");
                  setAdding(false);
                }
                if (event.key === "Escape") setAdding(false);
              }}
              className="flex-1 rounded border bg-canvas px-2 py-1 text-[12.5px] text-ink outline-none hairline"
            />
            <select
              value={newType}
              onChange={(event) => setNewType(event.target.value as PropertyType)}
              className="rounded border bg-canvas px-1 py-1 text-[11px] text-muted outline-none hairline"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1 flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] text-muted hover:bg-hover hover:text-ink"
          >
            <Plus size={13} /> Добавить свойство
          </button>
        )}
      </div>
    </div>
  );
}

function PropertyValue({
  property,
  onChange,
}: {
  property: Property;
  onChange(value: Property["value"]): void;
}) {
  if (property.type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={Boolean(property.value)}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 flex-1 accent-[var(--fn-accent)] justify-self-start"
      />
    );
  }
  if (property.type === "list") {
    const items = (property.value as string[]) ?? [];
    return (
      <input
        value={items.join(", ")}
        placeholder="значения через запятую"
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
      />
    );
  }
  return (
    <input
      type={property.type === "number" ? "number" : property.type === "date" ? "date" : "text"}
      value={String(property.value)}
      onChange={(event) =>
        onChange(property.type === "number" ? Number(event.target.value) : event.target.value)
      }
      className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
    />
  );
}
