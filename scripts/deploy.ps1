$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$remote = 'gigalixir'
$branch = 'main'

if (-not (git remote get-url $remote 2>$null)) {
  Write-Error "Remote '$remote' non configurato. Esegui: gigalixir git:remote -a ianime"
}

Write-Host 'Bump versione...'
$versionLabel = (npm run version:bump --silent 2>&1 | Select-Object -Last 1).Trim()
if (-not $versionLabel) {
  Write-Error 'Impossibile leggere la nuova versione da npm run version:bump'
}
Write-Host "Nuova versione: $versionLabel"

git add client/src/version.json
$pending = git diff --cached --name-only
$unstaged = git diff --name-only
if ($unstaged) {
  git add -A
  $pending = git diff --cached --name-only
}

if ($pending) {
  $details = ($pending | Where-Object { $_ -ne 'client/src/version.json' }) -join ', '
  if ($details) {
    $message = "Release $versionLabel - $details"
  } else {
    $message = "Release $versionLabel"
  }
  git commit -m $message
} else {
  Write-Host 'Nessuna modifica da committare oltre alla versione.'
  git commit -m "Release $versionLabel"
}

Write-Host "Deploy su Gigalixir ($remote/$branch)..."
git push $remote $branch
Write-Host "Fatto. $versionLabel -> https://ianime.gigalixirapp.com"
