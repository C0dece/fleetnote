import { useSettingsStore } from "@/stores/settingsStore";
import { ChipsField, Row, Slider } from "../fields";

const NAV_OPTIONS = [
  { value: "files", label: "Файлы" },
  { value: "search", label: "Поиск" },
  { value: "new", label: "Новая" },
  { value: "tabs", label: "Вкладки" },
  { value: "sync", label: "Облако" },
  { value: "graph", label: "Граф" },
  { value: "settings", label: "Настройки" },
];

const TOOLBAR_OPTIONS = [
  { value: "link", label: "[[ ]]" },
  { value: "tag", label: "#" },
  { value: "task", label: "- [ ]" },
  { value: "bold", label: "B" },
  { value: "italic", label: "I" },
  { value: "code", label: "`" },
  { value: "h1", label: "H1" },
  { value: "h2", label: "H2" },
  { value: "quote", label: "Цитата" },
  { value: "divider", label: "---" },
  { value: "table", label: "Таблица" },
  { value: "indent", label: "Отступ" },
  { value: "undo", label: "Отмена" },
  { value: "redo", label: "Повтор" },
];

export function MobileSection() {
  const mobile = useSettingsStore((state) => state.mobile);
  const set = useSettingsStore((state) => state.set);

  return (
    <div className="flex flex-col">
      <Row label="Нижняя панель" hint="Какие кнопки показывать в зоне большого пальца" stacked>
        <ChipsField
          value={mobile.bottomNav}
          options={NAV_OPTIONS}
          onChange={(bottomNav) => set("mobile", { bottomNav })}
        />
      </Row>

      <Row label="Надклавиатурная панель" hint="Кнопки быстрой разметки над клавиатурой" stacked>
        <ChipsField
          value={mobile.toolbarButtons}
          options={TOOLBAR_OPTIONS}
          onChange={(toolbarButtons) => set("mobile", { toolbarButtons })}
        />
      </Row>

      <Row label="Высота строк списка" hint="Насколько крупные цели для пальца">
        <Slider
          value={mobile.touchRowHeight}
          min={38}
          max={60}
          unit=" px"
          onChange={(touchRowHeight) => set("mobile", { touchRowHeight })}
        />
      </Row>
    </div>
  );
}
