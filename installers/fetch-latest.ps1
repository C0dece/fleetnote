# Скачивает Windows-установщики последнего релиза в папку installers\.
$ErrorActionPreference = "Stop"
$repo = if ($env:FLEETNOTE_REPO) { $env:FLEETNOTE_REPO } else { "C0dece/fleetnote" }
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Ищу последний релиз $repo…"
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
$assets = $release.assets | Where-Object { $_.name -match '\.(exe|msi)$' }
if (-not $assets) { throw "Установщики не найдены в последнем релизе" }

Get-ChildItem $dir -Include *.exe, *.msi -File -ErrorAction SilentlyContinue | Remove-Item
foreach ($asset in $assets) {
  Write-Host "Скачиваю $($asset.name)"
  Invoke-WebRequest $asset.browser_download_url -OutFile (Join-Path $dir $asset.name)
}
Write-Host "Готово."
