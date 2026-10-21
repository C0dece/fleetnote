#!/usr/bin/env bash
# Собирает архив проекта для переноса на ПК: fleetnote.tar.gz рядом с папкой проекта.
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
out="${1:-$(dirname "$root")/fleetnote.tar.gz}"
tar --exclude-vcs --exclude='node_modules' --exclude='.venv' --exclude='__pycache__' \
    --exclude='dist' --exclude='build' --exclude='*.tar.gz' \
    -czf "$out" -C "$(dirname "$root")" "$(basename "$root")"
echo "$out"
