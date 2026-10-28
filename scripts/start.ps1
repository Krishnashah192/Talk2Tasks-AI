# Talk2Tasks AI - Dual Server Launch Script
# Run with: powershell -ExecutionPolicy Bypass -File scripts\start.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       Starting Talk2Tasks AI (Backend + Frontend)        " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$backendPython = Join-Path $projectRoot "backend\venv\Scripts\python.exe"

if (-not (Test-Path $backendPython)) {
    Write-Host "[ERROR] Virtualenv not found. Running setup first..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File "$projectRoot\scripts\setup.ps1"
}

# 1. Start FastAPI Backend in background
Write-Host "Starting FastAPI backend server on http://localhost:8000..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath $backendPython `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory "$projectRoot\backend" `
    -PassThru

# 2. Wait for Backend Health
Write-Host "Waiting for backend to become ready..." -ForegroundColor Gray
$retries = 15
$ready = $false
while ($retries -gt 0) {
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 1 -ErrorAction Stop
        if ($res.status -eq "ok") {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 800
        $retries--
    }
}

if ($ready) {
    Write-Host "  [OK] Backend is healthy and listening on port 8000!" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Backend starting in background, continuing..." -ForegroundColor Yellow
}

# 3. Open browser after short delay
Start-Process "http://localhost:5173"

# 4. Start Frontend
Write-Host "`nStarting Frontend Vite server on http://localhost:5173..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop both frontend and backend." -ForegroundColor White
Write-Host ""

Set-Location "$projectRoot\frontend"

try {
    npx vite --port 5173 --host 127.0.0.1
} finally {
    Write-Host "`nShutting down backend process (PID: $($backendProcess.Id))..." -ForegroundColor Yellow
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Servers stopped. Goodbye!" -ForegroundColor Green
}
