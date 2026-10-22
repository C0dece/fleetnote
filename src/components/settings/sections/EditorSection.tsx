import { useSettingsStore } from "@/stores/settingsStore";
import { Row, Segmented, Slider, Toggle } from "../fields";

export function EditorSection() {
  const editor = useSettingsStore((state) => state.editor);
  const set = useSettingsStore((state) => state.set);

  return (
    <div className="flex flex-col">
      <Row
        label="Режим по умолчанию"
        hint="Исходник показывает всю разметку, живое превью прячет её вне курсора, чтение — только результат"
      >
        <Segmented
          value={editor.defaultMode}
          onChange={(defaultMode) => set("editor", { defaultMode })}
          options={[
            { value: "source", label: "Исходник" },
            { value: "live", label: "Живое превью" },
            { value: "reading", label: "Чтение" },
          ]}
        />
      </Row>

      <Row label="Задержка автосохранения" hint="Через сколько тишины заметка пишется на диск">
        <Slider
          value={editor.autosaveMs}
          min={200}
          max={3000}
          step={100}
          unit=" мс"
          onChange={(autosaveMs) => set("editor", { autosaveMs })}
        />
      </Row>

      <Row label="Размер отступа">
        <Slider
          value={editor.indentSize}
          min={2}
          max={8}
          onChange={(indentSize) => set("editor", { indentSize })}
        />
      </Row>

      <Row label="Проверка орфографии">
        <Toggle value={editor.spellcheck} onChange={(spellcheck) => set("editor", { spellcheck })} />
      </Row>

      <Row label="Автоматически закрывать скобки" hint="Включая `[[` для ссылок">
        <Toggle
          value={editor.autoPairBrackets}
          onChange={(autoPairBrackets) => set("editor", { autoPairBrackets })}
        />
      </Row>

      <Row label="Панель быстрых вставок" hint="Заголовки, списки, таблица, выноска — над текстом">
        <Toggle value={editor.showToolbar} onChange={(showToolbar) => set("editor", { showToolbar })} />
      </Row>

      <Row label="Меню по «/»" hint="Ввод слэша в пустой строке открывает список вставок">
        <Toggle value={editor.slashMenu} onChange={(slashMenu) => set("editor", { slashMenu })} />
      </Row>

      <Row label="Панель свойств" hint="Поля заметки из frontmatter над текстом">
        <Toggle
          value={editor.showProperties}
          onChange={(showProperties) => set("editor", { showProperties })}
        />
      </Row>

      <Row label="Сворачивание разделов" hint="Стрелка у заголовка скрывает его содержимое">
        <Toggle value={editor.foldHeadings} onChange={(foldHeadings) => set("editor", { foldHeadings })} />
      </Row>
    </div>
  );
}
