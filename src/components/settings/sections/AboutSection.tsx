import { useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVaultStore } from "@/stores/vaultStore";
import { Row } from "../fields";

export function AboutSection() {
  const settings = useSettingsStore();
  const notes = useVaultStore((state) => state.notes.length);
  const [json, setJson] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      <Row label="Fleetnote" hint="Markdown-база знаний для ПК и смартфонов">
        <span className="text-[13px] text-muted">версия 0.2.1</span>
      </Row>

      <Row label="В текущей базе" hint="Заметок в индексе">
        <span className="text-[13px] tabular-nums text-muted">{notes}</span>
      </Row>

      <Row
        label="Настройки файлом"
        hint="Скопируйте JSON, чтобы перенести конфигурацию на другое устройство"
        stacked
      >
        <div className="flex flex-col gap-2">
          <textarea
            value={json}
            onChange={(event) => setJson(event.target.value)}
            placeholder="Здесь появится JSON настроек"
            className="h-36 w-full rounded-lg border bg-canvas p-2 font-mono text-[12px] text-ink outline-none hairline focus:border-accent"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setJson(settings.export());
                setStatus("Настройки выгружены в поле");
              }}
              className="touch-row rounded-xl border px-3 text-[13.5px] text-ink hairline hover:bg-hover"
            >
              Выгрузить
            </button>
            <button
              type="button"
              onClick={() =>
                setStatus(settings.import(json) ? "Настройки применены" : "Не удалось разобрать JSON")
              }
              className="touch-row rounded-xl border px-3 text-[13.5px] text-ink hairline hover:bg-hover"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={() => {
                settings.resetAll();
                setStatus("Сброшено к значениям по умолчанию");
              }}
              className="touch-row rounded-xl border px-3 text-[13.5px] text-danger hairline hover:bg-hover"
            >
              Сбросить всё
            </button>
          </div>
          {status && <span className="text-[12.5px] text-muted">{status}</span>}
        </div>
      </Row>
    </div>
  );
}
