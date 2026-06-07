$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Get-PythonPath {
    $venvPython = Join-Path $Root "server\.venv\Scripts\python.exe"
    if (Test-Path $venvPython) { return $venvPython }
    return "python"
}

function Show-LanUrls($port) {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -ExpandProperty IPAddress -Unique
    if ($ips) {
        Write-Host ""
        Write-Host "Da telefono (stessa Wi-Fi):" -ForegroundColor Cyan
        foreach ($ip in $ips) {
            Write-Host "  http://${ip}:$port/" -ForegroundColor Green
        }
        Write-Host ""
    }
}

$python = Get-PythonPath
$serverDir = Join-Path $Root "server"
$clientDir = Join-Path $Root "client"

Write-Host "Avvio backend (FastAPI) su http://0.0.0.0:8000 ..."
$backend = Start-Process -FilePath $python `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000") `
    -WorkingDirectory $serverDir `
    -PassThru `
    -NoNewWindow

Write-Host "Backend PID: $($backend.Id)"
Write-Host "Avvio frontend (Vite) su http://0.0.0.0:5173 ..."
Show-LanUrls 5173
Write-Host ""

Push-Location $clientDir
try {
    npm run dev -- --host 0.0.0.0 --port 5173
} finally {
    Pop-Location
    if (-not $backend.HasExited) {
        Write-Host ""
        Write-Host "Arresto backend..."
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
}
