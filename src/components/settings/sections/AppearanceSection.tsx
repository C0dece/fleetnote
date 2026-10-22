import { useSettingsStore } from "@/stores/settingsStore";
import { ColorField, Row, SelectField, Segmented, Slider, TextField, Toggle } from "../fields";

const SANS_PRESETS = [
  {
    value: '"Inter", "SF Pro Text", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    label: "Inter / системный",
  },
  { value: "system-ui, sans-serif", label: "Системный" },
  { value: 'Georgia, "Times New Roman", serif', label: "С засечками" },
  { value: '"JetBrains Mono", ui-monospace, monospace', label: "Моноширинный" },
];

const MONO_PRESETS = [
  { value: '"JetBrains Mono", "SF Mono", "Cascadia Mono", ui-monospace, monospace', label: "JetBrains Mono" },
  { value: '"Fira Code", ui-monospace, monospace', label: "Fira Code" },
  { value: "ui-monospace, monospace", label: "Системный моноширинный" },
];

export function AppearanceSection() {
  const appearance = useSettingsStore((state) => state.appearance);
  const set = useSettingsStore((state) => state.set);

  return (
    <div className="flex flex-col">
      <Row label="Тема" hint="Системная подстраивается под оформление ОС">
        <Segmented
          value={appearance.theme}
          onChange={(theme) => set("appearance", { theme })}
          options={[
            { value: "system", label: "Системная" },
            { value: "light", label: "Светлая" },
            { value: "dark", label: "Тёмная" },
            { value: "amoled", label: "AMOLED" },
          ]}
        />
      </Row>

      <Row label="Акцентный цвет" hint="Ссылки, активные элементы, индикатор синхронизации">
        <ColorField value={appearance.accent} onChange={(accent) => set("appearance", { accent })} />
      </Row>

      <Row label="Шрифт интерфейса и текста">
        <SelectField
          value={appearance.fontSans}
          options={SANS_PRESETS}
          onChange={(fontSans) => set("appearance", { fontSans })}
        />
      </Row>

      <Row label="Шрифт кода">
        <SelectField
          value={appearance.fontMono}
          options={MONO_PRESETS}
          onChange={(fontMono) => set("appearance", { fontMono })}
        />
      </Row>

      <Row label="Кегль текста заметки">
        <Slider
          value={appearance.fontSize}
          min={12}
          max={24}
          unit=" px"
          onChange={(fontSize) => set("appearance", { fontSize })}
        />
      </Row>

      <Row label="Межстрочный интервал">
        <Slider
          value={appearance.lineHeight}
          min={1.2}
          max={2.2}
          step={0.05}
          onChange={(lineHeight) => set("appearance", { lineHeight })}
        />
      </Row>

      <Row
        label="Ширина области текста"
        hint="Сколько символов помещается в строку. Короткая строка читается легче, широкая вмещает таблицы."
      >
        <Slider
          value={appearance.measure}
          min={40}
          max={140}
          unit=" ch"
          onChange={(measure) => set("appearance", { measure })}
        />
      </Row>

      <Row label="Растянуть текст на всю ширину" hint="Игнорировать ограничение ширины колонки">
        <Toggle value={appearance.fullWidth} onChange={(fullWidth) => set("appearance", { fullWidth })} />
      </Row>

      <Row label="Масштаб интерфейса">
        <Slider
          value={appearance.uiScale}
          min={0.85}
          max={1.4}
          step={0.05}
          onChange={(uiScale) => set("appearance", { uiScale })}
        />
      </Row>

      <Row label="Строка состояния" hint="Нижняя полоса со счётчиком заметок и статусом синхронизации">
        <Toggle
          value={appearance.showStatusBar}
          onChange={(showStatusBar) => set("appearance", { showStatusBar })}
        />
      </Row>

      <Row label="Строка вкладок">
        <Toggle
          value={appearance.showTabStrip}
          onChange={(showTabStrip) => set("appearance", { showTabStrip })}
        />
      </Row>

      <Row
        label="Рамка окна"
        hint="Системная даёт привычные кнопки, перетаскивание и прилипание к краям. Своя выглядит компактнее."
      >
        <Segmented
          value={appearance.windowFrame}
          onChange={(windowFrame) => set("appearance", { windowFrame })}
          options={[
            { value: "native", label: "Системная" },
            { value: "custom", label: "Своя" },
          ]}
        />
      </Row>

      <Row label="Свой шрифт (CSS font-family)" hint="Переопределяет выбор выше" stacked>
        <TextField
          wide
          value={appearance.fontSans}
          onChange={(fontSans) => set("appearance", { fontSans })}
          placeholder='"Inter", system-ui, sans-serif'
        />
      </Row>
    </div>
  );
}
