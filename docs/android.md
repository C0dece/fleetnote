# Проверка приложения на Android

Мобильная сборка использует тот же код, что и десктопная: Tauri оборачивает его
в нативное приложение, а интерфейс сам переключается в мобильную раскладку.

## Что нужно один раз установить

| Компонент                                                | Зачем                | Проверка               |
| -------------------------------------------------------- | -------------------- | ---------------------- |
| JDK 17                                                   | Gradle-сборка        | `java -version`        |
| Android SDK (cmdline-tools, platform-tools, build-tools) | компиляция и adb     | `sdkmanager --list`    |
| Android NDK                                              | нативная часть Tauri | `ls $ANDROID_HOME/ndk` |
| Образ системы + эмулятор                                 | запуск без телефона  | `emulator -list-avds`  |

Переменные окружения:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls "$ANDROID_HOME/ndk" | tail -1)"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Цели Rust для Android:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## Запуск на эмуляторе

```bash
./scripts/android-emulator.sh        # создаёт AVD (если нет), поднимает эмулятор
npm run android:init                 # один раз: генерирует проект в src-tauri/gen/android
npm run android:dev                  # сборка и установка в запущенный эмулятор
```

Скрипт `scripts/android-emulator.sh` проверяет окружение, создаёт AVD
`fleetnote-test` (Pixel 6, API 34, x86_64 — на обычном ПК он быстрее arm-образа),
запускает эмулятор и ждёт, пока система загрузится.

## Сборка APK/AAB

```bash
npm run android:build                # debug/release артефакты в src-tauri/gen/android/app/build/outputs
```

Для релиза нужен ключ подписи: создайте `keystore.jks`, пропишите его в
`src-tauri/gen/android/keystore.properties` — Tauri подхватит его при сборке.

## Что проверять на эмуляторе в первую очередь

1. Открытие базы: локальная папка недоступна так же, как на ПК, — проверяется
   режим сетевого хранилища и кэш.
2. Клавиатура: надклавиатурная панель держится над клавиатурой, поле ввода не
   перекрывается (`visualViewport`).
3. Безопасные зоны: верхняя чёлка и нижняя полоса не перекрывают интерфейс.
4. Жесты: свайп от левого края возвращает назад, шторки тянутся и закрываются.
5. Офлайн: в режиме «Самолёт» заметки создаются и правятся, очередь синхронизации
   растёт, после включения сети уходит.
