# Fleetnote — Архитектурная спецификация и мастер-план разработки для ИИ-агента

Документ представляет собой полное техническое задание (ТЗ), дизайн-систему и пошаговый план разработки кроссплатформенного приложения для заметок в стиле Obsidian. Вы можете сохранить этот файл в корень будущего репозитория как `SPEC.md` или `CLAUDE.md` и подавать ИИ-агенту (Cursor, Windsurf, Claude Code, Cline) по фазам.

## 1. Концепция и варианты названия проекта

Для минималистичного, быстрого и кроссплатформенного редактора баз знаний лучше всего подходят короткие, звучные имена, отражающие связь заметок, скорость и облачную свободу:

| Название | Идея и позиционирование | Имя бинарника / пакета |
| :--- | :--- | :--- |
| **Fleetnote** *(выбранное)* | От *fleet* (быстрый, стремительный) + *note*; подчеркивает мгновенный отклик и единую «флотилию» устройств с общей базой | `fleetnote` / `app.fleetnote.notes` |
| **VeloNote** | От *Velocity* (скорость) + *Note*; подчеркивает мгновенный отклик на ПК и смартфоне | `velonote` / `app.velonote.core` |
| **AetherVault** | «Эфирное хранилище» — акцент на том, что база живет в любом облаке (Google Drive, WebDAV, S3) | `aethervault` / `io.aethervault.app` |
| **Looma** | От *Loom* (ткацкий станок) — сплетение мыслей через двусторонние ссылки `[[WikiLinks]]` | `looma-md` / `dev.looma.app` |

В рамках данной спецификации используется название **Fleetnote**.

## 2. Технологический стек обеспечивает сборку под ПК и смартфоны из единой кодовой базы

Главное требование — разработать и довести до идеала ПК-версию, а затем собрать мобильные приложения (iOS / Android) с минимальными изменениями кода и без потерь в производительности. Классический Electron не поддерживает мобильные ОС, а React Native плохо работает с тяжелыми десктопными редакторами и многооконностью. Оптимальный выбор — связка [Tauri v2](https://www.google.com/search?q=https%3A%2F%2Fv2.tauri.app%2F) ([GitHub](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Ftauri-apps%2Ftauri)) + веб-стек на TypeScript:

| Слой архитектуры | Инструмент / библиотека | Обоснование выбора для ПК + Мобайл |
| :--- | :--- | :--- |
| **Кроссплатформенное ядро** | [Tauri v2](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Ftauri-apps%2Ftauri) | Собирает единый фронтенд под Windows, macOS, Linux, iOS и Android; бинарник весит ~10 МБ вместо 150+ МБ у Electron |
| **UI-фреймворк и язык** | React 19 + TypeScript + Vite | Единая компонентная база; строгая типизация для файловых адаптеров и синхронизации |
| **Стилизация и адаптив** | [Tailwind CSS v4](https://www.google.com/search?q=https%3A%2F%2Ftailwindcss.com%2Fdocs) + CSS Variables | Мгновенное переключение тем (Light / Dark / OLED Black) и адаптивных брейкпоинтов (`md:`, `lg:`) |
| **Ядро Markdown-редактора** | [CodeMirror 6 (@codemirror/lang-markdown)](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fcodemirror%2Flang-markdown) + [codemirror-live-markdown](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fblueberrycongee%2Fcodemirror-live-markdown) | Тот же движок, что лежит в основе самого Obsidian: режим Live Preview (скрытие разметки вне курсора), кастомные плагины для `[[ссылок]]` и `#тегов`, нативная поддержка тач-экранов. Альтернатива для готового WYSIWYG — [Milkdown](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2FMilkdown%2Fmilkdown) |
| **Управление состоянием** | [Zustand](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fpmndrs%2Fzustand) | Легковесный стор без шаблонного кода, идеально подходящий для хранения дерева файлов, открытых вкладок и статуса синхронизации |
| **Локальный индекс и кэш** | [tauri-plugin-sql (SQLite)](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Ftauri-apps%2Ftauri-plugin-sql) + [tauri-plugin-fs](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Ftauri-apps%2Ftauri-plugin-fs) | Локальное хранение `.md`-файлов на устройстве и мгновенное индексирование метаданных, обратных ссылок (backlinks) и графа |
| **Полнотекстовый поиск** | [MiniSearch](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Flucaong%2Fminisearch) | Нечеткий (fuzzy) поиск по заголовкам, тегам и тексту тысяч заметок за <10 мс прямо в памяти |
| **UI-примитивы и иконки** | [cmdk](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fdip%2Fcmdk), [Vaul](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Femilkowalski%2Fvaul), [Lucide Icons](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Flucide-icons%2Flucide) | Палитра команд (`Ctrl/Cmd+K`) через `cmdk`, нативные мобильные шторки (bottom sheets) через `Vaul`, чистая иконографика `Lucide` |
| **Облачные коннекторы** | [Google Drive REST API v3](https://www.google.com/search?q=https%3A%2F%2Fdevelopers.google.com%2Fworkspace%2Fdrive%2Fapi%2Freference%2Frest%2Fv3), [webdav-client](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fperry-mitchell%2Fwebdav-client), [@aws-sdk/client-s3](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Faws%2Faws-sdk-js-v3%2Fblob%2Fmain%2Fclients%2Fclient-s3%2FREADME.md) | Прямая работа с любым облаком по единому интерфейсу `StorageProvider` без привязки к платной подписке |

## 3. Архитектура хранения «Local-First + Cloud-Agnostic» решает проблему любой сетевой базы

Главная ошибка при создании заметочников с облачной базой — пытаться читать и писать файлы напрямую в сеть при каждом нажатии клавиши. На мобильном интернете это приводит к фризам интерфейса и потере текста.

Правильная архитектура строится по принципу **Local-First с абстрактным провайдером синхронизации (`Virtual Vault Engine`)**:

1. **Мгновенный локальный слой (Local Vault Cache)**: Приложение всегда читает и сохраняет `.md`-файлы в локальную файловую систему через [tauri-plugin-fs](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Ftauri-apps%2Ftauri-plugin-fs) и обновляет индекс в [SQLite (tauri-plugin-sql)](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Ftauri-apps%2Ftauri-plugin-sql). Время отклика интерфейса — 0 мс, полная работа офлайн.
2. **Единый интерфейс удаленного хранилища (`IStorageAdapter`)**: Фоновый синхронизатор общается с облаком через строгий TypeScript-контракт, поэтому приложению безразлично, где лежит база:
   - `LocalFolderAdapter` — просто папка на диске ПК (может синхронизироваться внешним клиентом Google Drive Desktop, Syncthing или iCloud).
   - `GoogleDriveAdapter` — прямая синхронизация через [Google Drive REST API v3](https://www.google.com/search?q=https%3A%2F%2Fdevelopers.google.com%2Fworkspace%2Fdrive%2Fapi%2Freference%2Frest%2Fv3) (OAuth2 PKCE) с поддержкой как обычной папки на Диске, так и скрытой папки `appDataFolder`. Критично для смартфонов, где Google Drive не монтируется как обычная локальная папка ОС.
   - `WebDavAdapter` — подключение к Nextcloud, Яндекс.Диску, OwnCloud или домашнему NAS через библиотеку [webdav-client](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fperry-mitchell%2Fwebdav-client).
   - `S3Adapter` — подключение к AWS S3, Cloudflare R2 или MinIO через [@aws-sdk/client-s3](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Faws%2Faws-sdk-js-v3%2Fblob%2Fmain%2Fclients%2Fclient-s3%2FREADME.md).
3. **Алгоритм дельта-синхронизации и разрешения конфликтов**:
   - В корне хранилища поддерживается легковесный манифест `.fleetnote/sync-manifest.json`, содержащий пути файлов, `mtime` (время изменения) и `sha256`-хэш контента.
   - При изменении заметки срабатывает debounce (1.5 секунды бездействия), файл пушится в выбранный облачный адаптер в фоновом потоке.
   - Если файл был изменен одновременно на ПК и телефоне в офлайне, вместо перезаписи применяется **3-way merge** (построчное слияние текста) или автоматическое создание копии `Note (Conflict 2026-10-21).md`, либо опциональная синхронизация структур через [Yjs CRDT](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fyjs%2Fyjs).

## 4. Изначальная дизайн-система и адаптивный UX исключают казусы при переносе с ПК на смартфон

Чтобы при переходе от десктопной версии к мобильной не пришлось переписывать верстку, интерфейс изначально проектируется на **адаптивных оболочках (`Adaptive Shell`)**: бизнес-логика и редактор общие на 100%, а навигационная обвязка автоматически перестраивается по CSS-брейкпоинту `768px` и типу указателя (`pointer: fine` vs `pointer: coarse`).

### Визуальный стиль и палитра («Tactile Minimalist Knowledge Studio»)

- **Цветовая схема (Dark / OLED-first)**:
  - Фон базового холста (ПК и телефон): `#0D0F12` (глубокий графит) и `#000000` (чистый черный режим для AMOLED-экранов смартфонов).
  - Фон боковых панелей и карточек: `#15181E` с тонкими границами `1px solid rgba(255, 255, 255, 0.07)`.
  - Светлая тема (Warm Paper): `#FAF8F5` (теплая бумага без резкого синего свечения), панели `#F2EFE9`, текст `#1C1E21`.
  - Акцентный цвет: `#6366F1` (Indigo) для активных ссылок `[[WikiLinks]]` и индикаторов синхронизации; `#10B981` (Emerald) — статус «Синхронизировано».
- **Типографика**:
  - Интерфейс: `Inter` или системный `SF Pro` / `Segoe UI Variable`.
  - Текст заметок: комфортная ширина строки `65ch` (`max-w-2xl` по центру области чтения), межстрочный интервал `1.65`, размер шрифта `16px` на мобильных (предотвращает авто-зум в iOS WebView) и `15px–16px` на ПК.
  - Код и таблицы: моноширинный `JetBrains Mono`.

### Сравнение раскладки: почему интерфейс не «сломается» на мобиле

| Элемент интерфейса | Поведение на ПК (`>= 768px`, мышь + клавиатура) | Поведение на смартфоне (`< 768px`, управление одним пальцем) |
| :--- | :--- | :--- |
| **Навигация по базе** | Левый закрепленный сайдбар (`260px`) с деревом папок, тегами и поиском (скрывается по `Cmd+\`) | Выдвижная нижняя шторка ([Vaul Drawer](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Femilkowalski%2Fvaul)) или свайп слева направо; дерево файлов с увеличенной высотой строки `44px` |
| **Вкладки и мультитаскинг** | Верхняя панель вкладок (Tabs) + разделение экрана (Split View по горизонтали/вертикали) | Нижняя кнопка переключения открытых заметок (как вкладки в мобильном браузере) + свайп назад для возврата по истории ссылок |
| **Палитра команд и поиск** | Модальное окно по центру сверху (`Cmd/Ctrl + K` и `Cmd/Ctrl + O`) на базе [cmdk](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fdip%2Fcmdk) | Полноэкранный Bottom-Sheet с полем ввода, привязанным прямо над экранной клавиатурой (в зоне досягаемости большого пальца) |
| **Форматирование Markdown** | Горячие клавиши (`Cmd+B`, `Cmd+I`) и всплывающее меню при выделении текста | **Надклавиатурная панель (Keyboard Accessory Toolbar)**, жестко приклеенная к верхнему краю виртуальной клавиатуры (`visualViewport API`): кнопки `[[]]` `#` `- [ ]` `H1` `**` `Tab` `Undo` |
| **Обратные ссылки и метаданные** | Правая инспектор-панель (Backlinks, локальный граф, оглавление заметки) | Компактный блок «Связанные заметки» в самом низу документа + вызов оглавления/графа по свайпу справа |
| **Учет системных зон (Safe Areas)** | Кастомный тонкий Titlebar с кнопками окна (`28px`) | Строгий учет `env(safe-area-inset-top)` (Dynamic Island / челка) и `env(safe-area-inset-bottom)` (полоска Home Indicator) + динамический расчет высоты через `window.visualViewport` при открытии клавиатуры |

## 5. Пошаговый план разработки (Roadmap: от идеального ПК к мобильной сборке)

Разработка разбита на **5 последовательных фаз**. Сначала мы доводим до идеала архитектуру, редактор и облачную синхронизацию на ПК (Фазы 1–3), затем одним шагом активируем мобильную оболочку и собираем пакеты под Android/iOS (Фаза 4–5).

- **Фаза 1 — Фундамент, Адаптивный Каркас и Локальное Хранилище (PC Core)**: Инициализация [Tauri v2](https://www.google.com/search?q=https%3A%2F%2Fv2.tauri.app%2F) + React + TypeScript + [Tailwind CSS v4](https://www.google.com/search?q=https%3A%2F%2Ftailwindcss.com%2Fdocs). Создание абстракции файловой системы `VaultFileSystem`, подключение [tauri-plugin-fs](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Ftauri-apps%2Ftauri-plugin-fs) и [tauri-plugin-sql](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Ftauri-apps%2Ftauri-plugin-sql). Верстка адаптивного каркаса `AppShell` (сразу с CSS-переменными и поддержкой ресайза панелей на ПК и шторок [Vaul](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Femilkowalski%2Fvaul) для узких экранов).
- **Фаза 2 — Идеальный Markdown-редактор и Граф Знаний (PC Perfection)**: Интеграция [CodeMirror 6](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fcodemirror%2Flang-markdown) с режимом Live Preview ([codemirror-live-markdown](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fblueberrycongee%2Fcodemirror-live-markdown)). Реализация парсера двусторонних ссылок `[[Название заметки]]`, автодополнения при вводе `[[` и `#`, чекбоксов `- [ ]`, вставки картинок из буфера обмена, а также мгновенного поиска через [MiniSearch](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Flucaong%2Fminisearch) и палитры команд [cmdk](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fdip%2Fcmdk).
- **Фаза 3 — Сетевой движок синхронизации (Google Drive, WebDAV, S3)**: Реализация интерфейса `IStorageAdapter` и фонового синхронизатора `SyncEngine`. Написание коннекторов к [Google Drive REST API v3](https://www.google.com/search?q=https%3A%2F%2Fdevelopers.google.com%2Fworkspace%2Fdrive%2Fapi%2Freference%2Frest%2Fv3), [WebDAV](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fperry-mitchell%2Fwebdav-client) и [S3](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Faws%2Faws-sdk-js-v3%2Fblob%2Fmain%2Fclients%2Fclient-s3%2FREADME.md). Добавление UI выбора хранилища («Локальная папка», «Google Диск», «WebDAV», «S3») и индикатора статуса синхронизации с разрешением конфликтов.
- **Фаза 4 — Мобильная адаптация и Тач-эргономика (Mobile Polish)**: Сборка проекта через `npx tauri android init` / `npx tauri ios init`. Подключение плагина `VisualViewport` для отслеживания высоты экранной клавиатуры, активация надклавиатурного тулбара быстрой разметки (`[[]]`, `#`, `- [ ]`), жестов свайпа, кнопки «Быстрая заметка» (Floating Action Button) и AMOLED-темы.
- **Фаза 5 — Тестирование, Оптимизация и Релизная Сборка**: Стресс-тест на базе из 5 000+ Markdown-заметок (виртуализация списков, Web Worker для индексации), проверка работы офлайн-режима и сборка установщиков (`.msi`, `.dmg`, `.AppImage`, `.apk` / `.aab`, `.ipa`).

## 6. Готовый мастер-промпт для загрузки в ИИ-агента

Скопируйте блок ниже целиком или укажите ИИ-агенту этот файл в качестве системной инструкции перед стартом проекта:

```text
Ты — Senior Full-Stack & Cross-Platform Architect. Твоя задача — разработать с нуля кроссплатформенное приложение для ведения базы знаний в формате Markdown под названием "Fleetnote" (легкий, быстрый и удобный аналог Obsidian для ПК и смартфонов с поддержкой хранения базы в любом облаке, включая Google Drive и WebDAV).

### 1. ТЕХНИЧЕСКИЙ СТЕК (СТРОГО СОБЛЮДАТЬ)
- Runtime & App Shell: Tauri v2 (Rust backend + WebView frontend, поддержка Desktop: Windows/macOS/Linux и Mobile: Android/iOS).
- Frontend: React 19, TypeScript (strict mode), Vite, Tailwind CSS v4.
- State Management: Zustand (с разделением на слайсы: useVaultStore, useEditorStore, useSyncStore, useUIStore).
- Markdown Editor: CodeMirror 6 (@codemirror/state, @codemirror/view, @codemirror/lang-markdown) с плагином Live Preview (скрытие синтаксиса разметки на неактивных строках, рендер чекбоксов, заголовков и кликабельных [[WikiLinks]]).
- Local Storage & Indexing: @tauri-apps/plugin-fs для чтения/записи локального кэша заметок + @tauri-apps/plugin-sql (SQLite) для хранения индекса заголовков, тегов (#tag) и графа связей (links/backlinks).
- Full-Text Search & Command Palette: MiniSearch (in-memory индекс) + cmdk (палитра команд Cmd/Ctrl+K) + vaul (мобильные шторки / drawers) + lucide-react (иконки).

### 2. АРХИТЕКТУРА ХРАНЕНИЯ И ОБЛАЧНОЙ СИНХРОНИЗАЦИИ (LOCAL-FIRST + CLOUD-AGNOSTIC)
Редактор НИКОГДА не блокирует ввод ожиданием сети. Все операции чтения/записи происходят мгновенно в локальном кэше устройства, а синхронизация работает в фоне через единый интерфейс:

interface IStorageAdapter {
  id: 'local' | 'gdrive' | 'webdav' | 's3';
  connect(config: Record<string, string>): Promise<boolean>;
  listFiles(): Promise<RemoteFileMeta[]>; // { path, mtime, hash }
  readFile(path: string): Promise<string | Uint8Array>;
  writeFile(path: string, content: string | Uint8Array, mtime: number): Promise<void>;
  deleteFile(path: string): Promise<void>;
}

Реализуй 4 адаптера:
1. LocalFolderAdapter — работа с выбранной папкой на диске через @tauri-apps/plugin-fs.
2. GoogleDriveAdapter — работа через Google Drive REST API v3 (OAuth 2.0 PKCE, хранение папки Vault на Google Диске, чтение/запись .md файлов и вложений).
3. WebDavAdapter — синхронизация с любым WebDAV-сервером (Nextcloud, Яндекс.Диск, OwnCloud) через пакет `webdav`.
4. S3Adapter — синхронизация с S3-совместимым бакетом (AWS S3, Cloudflare R2, MinIO).

Движок синхронизации (`SyncEngine`):
- Хранит локальный и удаленный манифест `.fleetnote/sync-manifest.json` (путь файла, sha256 хэш, timestamp).
- При редактировании заметки запускает фоновый push с debounce 1500 мс.
- При обнаружении конфликта (файл изменен и локально, и в облаке с момента последней синхронизации) пытается выполнить построчный merge; при пересечении строк сохраняет обе версии, создавая файл `<filename> (Conflict YYYY-MM-DD HH-mm).md`, и уведомляет пользователя.

### 3. ИЗНАЧАЛЬНЫЙ АДАПТИВНЫЙ ДИЗАЙН (PC-FIRST С ГОТОВНОСТЬЮ К MOBILE)
Верстка должна изначально строиться на адаптивном компоненте `<ResponsiveLayout />`, чтобы при сборке под Android/iOS не переписывать компоненты:
- CSS-переменные и темы: Light (Warm Paper #FAF8F5), Dark (Graphite #0D0F12) и AMOLED Black (#000000).
- Брейкпоинт Desktop (`>= 768px`):
  - Трехколоночный макет: Левый сайдбар (Дерево файлов, Поиск, Закладки) | Центральная область (Вкладки + Редактор CodeMirror 6 с поддержкой Split View) | Правый сайдбар (Обратные ссылки Backlinks, Оглавление, Мини-граф).
  - Полная поддержка хоткеев: `Cmd/Ctrl+P` / `Cmd/Ctrl+K` (палитра команд), `Cmd/Ctrl+O` (быстрое открытие заметки), `Cmd/Ctrl+N` (новая заметка), `Cmd/Ctrl+\` (скрыть сайдбар).
- Брейкпоинт Mobile (`< 768px` или `pointer: coarse`):
  - Сайдбары автоматически превращаются в жесты/шторки (Drawers на базе `vaul`), не занимая место на экране.
  - Все интерактивные элементы (строки дерева файлов, кнопки) получают минимальную высоту `44px` для удобного нажатия пальцем.
  - Нижняя навигационная панель (Bottom Navigation Bar) в зоне большого пальца: [Файлы] [Поиск] [+ Новая заметка] [Вкладки] [Синхронизация].
  - Надклавиатурная панель (Mobile Markdown Toolbar): используй `window.visualViewport`, чтобы при открытии экранной клавиатуры фиксировать над ней горизонтально скроллящуюся полоску с быстрыми кнопками: `[[ ]]`, `#`, `- [ ]`, `**B**`, `*I*`, `H1-H3`, `Tab`, `Shift+Tab`, `Undo`, `Redo`.
  - Учитывай системные отступы `env(safe-area-inset-top)` и `env(safe-area-inset-bottom)`.

### 4. СТРУКТУРА ПРОЕКТА
Организуй код строго по модулям:
src/
├── core/
│   ├── vault/          # Абстракция Vault, парсер Markdown, извлечение [[WikiLinks]] и #tags
│   ├── index/          # SQLite индекс + MiniSearch полнотекстовый поиск + граф связей
│   └── sync/           # SyncEngine, манифест, разрешение конфликтов и адаптеры (local, gdrive, webdav, s3)
├── components/
│   ├── layout/         # AdaptiveShell, DesktopSidebars, MobileBottomNav, MobileDrawers
│   ├── editor/         # CodeMirror 6 обвязка, LivePreview расширения, MobileKeyboardToolbar
│   ├── navigation/     # FileTree (виртуализированный), CommandPalette (cmdk), QuickSwitcher
│   └── backlinks/      # Панель обратных ссылок, Outgoing links, интерактивный локальный граф
├── stores/             # Zustand сторы (vaultStore, editorStore, syncStore, settingsStore)
└── styles/             # Tailwind v4 конфиг, цветовые токены и safe-area утилиты

### 5. ПРАВИЛА ПОШАГОВОЙ РЕАЛИЗАЦИИ ДЛЯ АГЕНТА
Мы идем по стратегии "Сначала идеальный ПК, затем бесшовный Мобайл". Выполняй разработку строго по этапам, проверяя компиляцию (`npm run build` и `cargo check`) после каждого шага:
- ШАГ 1: Сгенерируй структуру проекта Tauri v2 + React + TS + Tailwind v4, настрой Zustand сторы и адаптивный `AdaptiveShell` (переключение Desktop/Mobile layout при ресайзе окна).
- ШАГ 2: Реализуй локальное ядро `VaultManager`, индексатор ссылок `[[WikiLinks]]` и `#tags`, полнотекстовый поиск `MiniSearch` и дерево файлов с созданием/переименованием/удалением папок и `.md`-заметок.
- ШАГ 3: Интегрируй редактор CodeMirror 6 с Live Preview, автодополнением `[[ссылок]]`, кликабельным переходом между заметками и панелью обратных ссылок (Backlinks).
- ШАГ 4: Реализуй `SyncEngine` и облачные адаптеры (`GoogleDriveAdapter`, `WebDavAdapter`, `S3Adapter`, `LocalFolderAdapter`) с окном настроек подключения и индикатором синхронизации.
- ШАГ 5: Доведи до совершенства мобильный режим (`MobileKeyboardToolbar` через `visualViewport`, свайп-шторки `vaul`, мобильные вкладки и конфигурацию Tauri Mobile для Android/iOS).

Начни с Шага 1: инициализируй проект, создай файловую структуру и базовый рабочий каркас приложения с переключаемыми темами и деревом заметок.
```

## 7. Чек-лист проверки перед переходом от ПК к мобильной сборке

Прежде чем запускать `npx tauri android build` или `npx tauri ios build`, убедитесь, что ПК-версия проходит следующие 5 проверок в узком окне (`390x844px` в DevTools):

1. **Никаких `hover`-зависимых действий**: Любое действие (удаление файла, переименование, открытие контекстного меню), которое на ПК вызывается правой кнопкой мыши или наведением курсора, продублировано кнопкой `...` или долгим нажатием (long-press).
2. **Изоляция от прямых путей ОС**: Код редактора и дерева файлов обращается к заметкам по относительным путям внутри базы (`/Daily/2026-10-21.md`), а не по системным путям (`C:\Users\...`), что позволяет на смартфоне прозрачно переключаться между локальным кэшем приложения и Google Drive API.
3. **Виртуализация длинных списков**: Дерево файлов и результаты поиска рендерят только видимые элементы, чтобы на телефоне открытие папки с 2 000 заметок происходило при стабильных 60/120 FPS.
4. **Независимость от физических клавиш**: Все функции `Ctrl+K`, `Ctrl+O` и `[[` доступны в один тап с нижней панели навигации и надклавиатурного тулбара.
5. **Офлайн-устойчивость**: При отключении Wi-Fi/LTE приложение позволяет создавать и редактировать заметки без ошибок, складывая изменения в локальную очередь `SyncQueue` до появления сети.
