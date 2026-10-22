#!/usr/bin/env bash
# Поднимает Android-эмулятор для проверки мобильной сборки Fleetnote.
set -euo pipefail

AVD_NAME="${AVD_NAME:-fleetnote-test}"
IMAGE="${IMAGE:-system-images;android-34;google_apis;x86_64}"
DEVICE="${DEVICE:-pixel_6}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Не найдено: $1. См. docs/android.md — там список того, что нужно установить."
    exit 1
  }
}

need sdkmanager
need avdmanager
need emulator
need adb

if ! emulator -list-avds | grep -qx "$AVD_NAME"; then
  echo "Создаю AVD $AVD_NAME ($IMAGE)…"
  sdkmanager --install "$IMAGE" "platform-tools" >/dev/null
  echo no | avdmanager create avd -n "$AVD_NAME" -k "$IMAGE" -d "$DEVICE"
fi

if adb devices | grep -q emulator; then
  echo "Эмулятор уже запущен."
else
  echo "Запускаю $AVD_NAME…"
  emulator -avd "$AVD_NAME" -netdelay none -netspeed full -no-snapshot-save >/dev/null 2>&1 &
fi

echo "Жду загрузки системы…"
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done

echo "Эмулятор готов. Дальше: npm run android:init (один раз) и npm run android:dev"
