#!/usr/bin/env bash
# Собирает архив проекта для переноса на другой компьютер.
# Внутрь не попадают зависимости и артефакты сборки: на новой машине
# всё восстанавливается командой `npm install`.
#
#   ./pack.sh            → fleetnote.zip и fleetnote.tar.gz рядом с папкой проекта
#   ./pack.sh zip        → только zip
#   ./pack.sh tar        → только tar.gz
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
name="$(basename "$root")"
parent="$(dirname "$root")"
what="${1:-all}"

excludes=(
  "$name/node_modules/*"
  "$name/dist/*"
  "$name/src-tauri/target/*"
  "$name/src-tauri/gen/*"
  "$name/.vite/*"
  "$name/*.zip"
  "$name/*.tar.gz"
)

if [ "$what" = "all" ] || [ "$what" = "zip" ]; then
  out_zip="$parent/$name.zip"
  rm -f "$out_zip"
  (cd "$parent" && zip -qr "$out_zip" "$name" -x "${excludes[@]}")
  echo "$out_zip"
fi

if [ "$what" = "all" ] || [ "$what" = "tar" ]; then
  out_tar="$parent/$name.tar.gz"
  tar_excludes=()
  for item in "${excludes[@]}"; do tar_excludes+=("--exclude=${item#"$name"/}"); done
  tar "${tar_excludes[@]}" -czf "$out_tar" -C "$parent" "$name"
  echo "$out_tar"
fi
