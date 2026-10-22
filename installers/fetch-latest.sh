#!/usr/bin/env bash
# Скачивает Windows-установщики последнего релиза в папку installers/.
set -euo pipefail

repo="${FLEETNOTE_REPO:-C0dece/fleetnote}"
dir="$(cd "$(dirname "$0")" && pwd)"

echo "Ищу последний релиз $repo…"
if command -v gh >/dev/null 2>&1; then
  urls=$(gh api "repos/$repo/releases/latest" --jq '.assets[] | select(.name | test("\\.(exe|msi)$")) | .browser_download_url')
else
  urls=$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" \
    | grep -o '"browser_download_url": *"[^"]*\.\(exe\|msi\)"' \
    | sed 's/.*"\(https[^"]*\)"/\1/')
fi

[ -n "$urls" ] || { echo "Установщики не найдены в последнем релизе"; exit 1; }

rm -f "$dir"/*.exe "$dir"/*.msi
while read -r url; do
  [ -n "$url" ] || continue
  echo "Скачиваю $(basename "$url")"
  curl -fL --progress-bar -o "$dir/$(basename "$url")" "$url"
done <<< "$urls"

echo "Готово: $(ls -1 "$dir"/*.exe "$dir"/*.msi 2>/dev/null | wc -l) файл(ов) в installers/"
